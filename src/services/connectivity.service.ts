import type Redis from "ioredis";
import { FilterQuery } from "mongoose";
import { ConnectivityModel } from "../models/connectivity.model";
import {
  bumpCollectionVersion,
  CacheKeys,
  del,
  getCollectionVersion,
  getJSON,
  hashKey,
  setJSON,
  stableStringify,
} from "../utils/cache";
import { ServerModel } from "../models/server.model";

/** ---------------- Service API ---------------- */
export type ConnectivityListFilter = {
  user_id?: string;
  server_id?: string;
  from?: string;
  to?: string;
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number;
  idTtlSec?: number;
  openPairTtlSec?: number;
  ttlSec?: number;
};

const DEFAULT_LIST_TTL = 30;
const DEFAULT_ID_TTL = 120;
const DEFAULT_OPEN_PAIR_TTL = 15;

const DEFAULT_TTL = 15; // short cache for dashboards

export async function getServersWithConnectionStats(
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, ttlSec = DEFAULT_TTL } = deps;

  const verConnectivity = await getCollectionVersion(redis);
  const cacheKey = CacheKeys.list(
    verConnectivity,
    hashKey(
      stableStringify({ k: "servers-with-connection-stats", page, limit })
    )
  );

  const cached = await getJSON<any>(redis, cacheKey);
  if (cached) return cached;

  // aggregate total + active counts
  const counts = await ConnectivityModel.aggregate([
    {
      $group: {
        _id: "$server_id",
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$disconnected_at", null] },
                  { $not: ["$disconnected_at"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const countMap = new Map<string, { total: number; active: number }>();
  for (const c of counts) {
    countMap.set(String(c._id), { total: c.total ?? 0, active: c.active ?? 0 });
  }

  // pagination
  const totalServers = await ServerModel.countDocuments();
  const servers = await ServerModel.find()
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const items = servers.map((s: any) => {
    const stats = countMap.get(String(s._id)) || { total: 0, active: 0 };
    return {
      server: { _id: s._id, ...s.general },
      connections: { total: stats.total, active: stats.active },
    };
  });

  const result = {
    success: true,
    pagination: {
      page,
      limit,
      total: totalServers,
      pages: Math.ceil(totalServers / limit) || 1,
    },
    data: items,
  };

  await setJSON(redis, cacheKey, result, ttlSec);
  return result;
}

export async function listConnectivity(
  filter: ConnectivityListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  const q: FilterQuery<any> = {};
  if (filter.user_id) q.user_id = filter.user_id;
  if (filter.server_id) q.server_id = filter.server_id;
  if (filter.from || filter.to) {
    q.connected_at = {};
    if (filter.from) (q.connected_at as any).$gte = new Date(filter.from);
    if (filter.to) (q.connected_at as any).$lte = new Date(filter.to);
  }

  const ver = await getCollectionVersion(redis);
  const keyPayload = { ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(keyPayload)));

  const cached = await getJSON<any>(redis, listKey);
  if (cached) return cached;

  const cursor = ConnectivityModel.find(q)
    .lean()
    .sort({ connected_at: -1, created_at: -1 });

  const total = await ConnectivityModel.countDocuments(q);
  const items = await cursor.skip((page - 1) * limit).limit(limit);

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: items,
  };

  await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function getConnectivityById(id: string, deps: CacheDeps = {}) {
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const idKey = CacheKeys.byId(id);
  const cached = await getJSON<any>(redis, idKey);
  if (cached) return cached;

  const doc = await ConnectivityModel.findById(id).lean();
  if (!doc) return null;

  await setJSON(redis, idKey, doc, idTtlSec);
  return doc;
}

export async function getOpenByPair(
  payload: { user_id: string; server_id: string },
  deps: CacheDeps = {}
) {
  const { redis, openPairTtlSec = DEFAULT_OPEN_PAIR_TTL } = deps;
  const key = CacheKeys.openByPair(payload.user_id, payload.server_id);
  const cached = await getJSON<any>(redis, key);
  if (cached !== null) return cached;

  const open = await ConnectivityModel.findOne({
    user_id: payload.user_id,
    server_id: payload.server_id,
    $or: [{ disconnected_at: null }, { disconnected_at: { $exists: false } }],
  }).lean();

  await setJSON(redis, key, open, openPairTtlSec);
  return open;
}

export async function connect(
  payload: { user_id: string; server_id: string },
  deps: CacheDeps = {}
): Promise<{ status: "created"; data: any } | { status: "conflict" }> {
  const { redis } = deps;
  const now = new Date();

  const existing = await ConnectivityModel.exists({
    user_id: payload.user_id,
    server_id: payload.server_id,
    $or: [{ disconnected_at: null }, { disconnected_at: { $exists: false } }],
  });
  if (existing) return { status: "conflict" };

  try {
    const created = await ConnectivityModel.create({
      user_id: payload.user_id,
      server_id: payload.server_id,
      connected_at: now,
      disconnected_at: null,
    });

    // Invalidate caches
    await bumpCollectionVersion(redis);
    await del(redis, CacheKeys.openByPair(payload.user_id, payload.server_id));

    return { status: "created", data: created.toObject() };
  } catch (err: any) {
    if (err?.code === 11000) {
      return { status: "conflict" };
    }
    throw err;
  }
}

export async function disconnect(
  payload: { user_id: string; server_id: string },
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const now = new Date();

  // Return a Document (no .lean()), then convert to POJO after cache work.
  const updatedDoc = await ConnectivityModel.findOneAndUpdate(
    {
      user_id: payload.user_id,
      server_id: payload.server_id,
      $or: [{ disconnected_at: null }, { disconnected_at: { $exists: false } }],
      connected_at: { $lte: now },
    },
    { $set: { disconnected_at: now } },
    { new: true, runValidators: true }
  );

  if (updatedDoc) {
    await bumpCollectionVersion(redis);
    await del(redis, CacheKeys.openByPair(payload.user_id, payload.server_id));
    await del(redis, CacheKeys.byId(String(updatedDoc._id)));
    return updatedDoc.toObject(); // keep your service contract returning plain JSON
  }

  return null; // no open session found
}

export async function deleteConnectivity(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await ConnectivityModel.findByIdAndDelete(id);
  if (res) {
    await del(redis, CacheKeys.byId(String(id)));
    await bumpCollectionVersion(redis);
  }
  return !!res;
}
