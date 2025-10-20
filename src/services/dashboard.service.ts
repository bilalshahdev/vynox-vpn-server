// src/services/dashboard.service.ts
import type Redis from "ioredis";
import crypto from "crypto";
import { ServerModel } from "../models/server.model";
import { ConnectivityModel } from "../models/connectivity.model";
import { FeedbackModel } from "../models/feedback.model";
import { AdModel } from "../models/ad.model";

type CacheDeps = { redis?: Redis; ttlSec?: number };
const DEFAULT_TTL = 15;

function hashKey(input: unknown) {
  return crypto.createHash("sha1").update(JSON.stringify(input)).digest("hex");
}
async function getJSON<T>(
  redis: Redis | undefined,
  key: string
): Promise<T | null> {
  if (!redis) return null;
  try {
    const v = await redis.get(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
async function setJSON(
  redis: Redis | undefined,
  key: string,
  value: unknown,
  ttlSec: number
) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {}
}

type OsBucket = "android" | "ios"

function normalizeByOsAgg(
  agg: Array<{ _id: string; count: number }>
): Record<OsBucket, number> {
  const base: Record<OsBucket, number> = { android: 0, ios: 0};
  for (const { _id, count } of agg) {
    if (_id === "android" || _id === "ios") {
      base[_id] = count;
    }
  }
  return base;
}

export async function getDashboardStats(
  recentLimit: number,
  deps: CacheDeps = {}
) {
  const { redis, ttlSec = DEFAULT_TTL } = deps;
  const cacheKey = `v1:dashboard:stats:${hashKey({ recentLimit })}`;

  const cached = await getJSON<any>(redis, cacheKey);
  if (cached) return cached;

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const last24h = new Date(now.getTime() - day);
  const last7d = new Date(now.getTime() - 7 * day);
  const last30d = new Date(now.getTime() - 30 * day);

  // --- Replace three countDocuments with ONE aggregation for by_os ---
  const byOsAggPromise = ServerModel.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$general.os_type", count: { $sum: 1 } } },
  ]);

  // Parallelize everything
  const [
    totalServers,
    byOsAgg, // <-- NEW
    liveServers,
    testServers,
    proServers,
    activeAds,
    totalAds,
    activeSessions,
    sessions24h,
    feedback7dCount,
    avgRatingAgg,
    topReasonsAgg,
    recentServers,
    recentConns,
    recentFeedback,
  ] = await Promise.all([
    ServerModel.countDocuments({}),
    byOsAggPromise, // <-- NEW
    ServerModel.countDocuments({ "general.mode": "live" }),
    ServerModel.countDocuments({ "general.mode": "test" }),
    ServerModel.countDocuments({ "general.is_pro": true }),
    AdModel.countDocuments({ status: true }),
    AdModel.countDocuments({}),
    ConnectivityModel.countDocuments({
      // disconnected_at: null,
      // connected_at: { $lte: now },
    }),
    ConnectivityModel.countDocuments({ connected_at: { $gte: last24h } }),
    FeedbackModel.countDocuments({ datetime: { $gte: last7d } }),
    FeedbackModel.aggregate<{ _id: null; avg: number }>([
      { $match: { datetime: { $gte: last30d } } },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]),
    FeedbackModel.aggregate<{ _id: string; count: number }>([
      { $match: { datetime: { $gte: last7d } } },
      { $group: { _id: "$reason", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
    ]),
    ServerModel.find({})
      .lean()
      .select({
        _id: 1,
        created_at: 1,
        "general.name": 1,
        "general.city": 1,
        "general.country": 1,
      })
      .sort({ created_at: -1 })
      .limit(recentLimit),
    ConnectivityModel.find({})
      .lean()
      .select({ _id: 1, user_id: 1, server_id: 1, connected_at: 1 })
      .sort({ connected_at: -1 })
      .limit(recentLimit),
    FeedbackModel.find({})
      .lean()
      .select({ _id: 1, reason: 1, datetime: 1 })
      .sort({ datetime: -1 })
      .limit(recentLimit),
  ]);

  // Normalize aggregates
  const byOs = normalizeByOsAgg(byOsAgg); // <-- always returns {android, ios}
  const avgRating30d = avgRatingAgg[0]?.avg
    ? Number(avgRatingAgg[0].avg.toFixed(2))
    : 0;
  const topReasons_7d = topReasonsAgg.map((r) => ({
    reason: r._id,
    count: r.count,
  }));

  // Merge recent activity (unchanged)
  type Activity = {
    type: "server" | "connectivity" | "feedback";
    title: string;
    when: Date;
    ref_id: string;
  };
  const recent: Activity[] = [
    ...recentServers.map((s: any) => ({
      type: "server" as const,
      title: `New server: ${s?.general?.name ?? s._id} (${
        s?.general?.city ?? ""
      }${s?.general?.country ? ", " + s.general.country : ""})`,
      when: s.created_at,
      ref_id: String(s._id),
    })),
    ...recentConns.map((c: any) => ({
      type: "connectivity" as const,
      title: `User connected (server ${c.server_id})`,
      when: c.connected_at,
      ref_id: String(c._id),
    })),
    ...recentFeedback.map((f: any) => ({
      type: "feedback" as const,
      title: `Feedback received: ${f.reason}`,
      when: f.datetime,
      ref_id: String(f._id),
    })),
  ]
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, Math.max(recentLimit, 1));

  const payload = {
    servers: {
      total: totalServers,
      by_os: byOs, // <-- { android, ios }
      by_mode: { live: liveServers, test: testServers },
      pro: proServers,
    },
    connections: {
      active: activeSessions,
      last_24h: sessions24h,
    },
    feedback: {
      last_7d: feedback7dCount,
      avg_rating_30d: avgRating30d,
      top_reasons_7d: topReasons_7d,
    },
    ads: {
      active: activeAds,
      total: totalAds,
    },
    recent_activity: recent.map((r) => ({
      ...r,
      when: new Date(r.when).toISOString(),
    })),
  };

  await setJSON(redis, cacheKey, payload, ttlSec);
  return payload;
}
