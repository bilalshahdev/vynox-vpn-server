// /services/connectivity.service.ts

import type Redis from "ioredis";
import { ConnectivityModel } from "../models/connectivity.model";
import { ServerModel } from "../models/server.model";
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

const DEFAULT_ID_TTL = 120;
const DEFAULT_OPEN_PAIR_TTL = 15;

const DEFAULT_TTL = 15;

type ServerStatsFilter = {
  os_type?: "android" | "ios";
  search?: string;
};

export async function getServersWithConnectionStats(
  page = 1,
  limit = 50,
  deps: CacheDeps = {},
  filter: ServerStatsFilter = {}
) {
  const { redis, ttlSec = DEFAULT_TTL } = deps;

  const versionBundle = await getCollectionVersion(redis);
  const cacheKey = CacheKeys.list(
    versionBundle,
    hashKey(
      stableStringify({
        k: "servers-with-connection-stats-v3",
        page,
        limit,
        os_type: filter.os_type ?? null,
        search: filter.search?.trim() || null,
      })
    )
  );

  const cached = await getJSON<any>(redis, cacheKey);
  if (cached) return cached;

  const match: any = {};
  if (filter.os_type) match["general.os_type"] = filter.os_type;

  const safeSearch =
    filter.search?.trim() && filter.search.length > 0
      ? new RegExp(filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

  const pipeline: any[] = [
    { $match: match },

    {
      $lookup: {
        from: "countries",
        localField: "general.country_id",
        foreignField: "_id",
        as: "country",
        pipeline: [{ $project: { _id: 1, name: 1 } }],
      },
    },
    { $unwind: "$country" },

    {
      $lookup: {
        from: "cities",
        localField: "general.city_id",
        foreignField: "_id",
        as: "city",
        pipeline: [{ $project: { _id: 1, name: 1 } }],
      },
    },
    { $unwind: "$city" },
  ];

  if (safeSearch) {
    pipeline.push({
      $match: {
        $or: [
          { "general.name": safeSearch },
          { "city.name": safeSearch },
          { "country.name": safeSearch },
        ],
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "connectivities",
        let: { sid: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$server_id", "$$sid"] },
            },
          },
          {
            $group: {
              _id: null,
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
          { $project: { _id: 0, total: 1, active: 1 } },
        ],
        as: "connections",
      },
    },
    {
      $addFields: {
        connections: {
          $ifNull: [{ $first: "$connections" }, { total: 0, active: 0 }],
        },
      },
    }
  );

  pipeline.push({
    $project: {
      _id: 1,
      name: "$general.name",
      os_type: "$general.os_type",
      country: "$country.name",
      city: "$city.name",
      connections: 1,
    },
  });

  pipeline.push({
    $facet: {
      meta: [{ $count: "total" }],
      data: [
        { $sort: { name: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ],
    },
  });

  const [agg] = await ServerModel.aggregate(pipeline).allowDiskUse(true);
  const total = agg?.meta?.[0]?.total ?? 0;
  const data = agg?.data ?? [];

  const result = {
    success: true,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
    data: data.map((s: any) => ({
      server: {
        _id: s._id,
        name: s.name,
        country: s.country || "",
        city: s.city || "",
        os_type: s.os_type,
      },
      connections: s.connections,
    })),
  };

  await setJSON(redis, cacheKey, result, ttlSec);
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
    return updatedDoc.toObject();
  }

  return null;
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
