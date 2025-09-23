import type Redis from "ioredis";
import crypto from "crypto";
import { FilterQuery } from "mongoose";
import { ConnectivityModel } from "../models/connectivity.model";

/** ---------------- Cache (scoped to connectivity) ---------------- */
const NS = "v1:connectivity";
const CacheKeys = {
  ver: () => `${NS}:ver`,
  list: (ver: string, hash: string) => `${NS}:${ver}:list:${hash}`,
  byId: (id: string) => `${NS}:id:${id}`,
  openByPair: (u: string, s: string) => `${NS}:open:${u}:${s}`,
};

async function getCollectionVersion(redis?: Redis): Promise<string> {
  if (!redis) return "0";
  const v = await redis.get(CacheKeys.ver());
  if (v) return v;
  await redis.set(CacheKeys.ver(), "1");
  return "1";
}
async function bumpCollectionVersion(redis?: Redis) {
  if (!redis) return;
  await redis.incr(CacheKeys.ver());
}
function stableStringify(obj: Record<string, unknown>) {
  const keys = Object.keys(obj).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = (obj as any)[k];
  return JSON.stringify(ordered);
}
function hashKey(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}
async function getJSON<T>(
  redis: Redis | undefined,
  key: string
): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
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
async function delKey(redis: Redis | undefined, key: string) {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
}

/** ---------------- Service API ---------------- */
export type ConnectivityListFilter = {
  user_id?: string;
  server_id?: string;
  from?: string; // ISO date-time for connected_at >= from
  to?: string; // ISO date-time for connected_at <= to
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number; // default 30
  idTtlSec?: number; // default 120
  openPairTtlSec?: number; // default 15
};

const DEFAULT_LIST_TTL = 30;
const DEFAULT_ID_TTL = 120;
const DEFAULT_OPEN_PAIR_TTL = 15;

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

/** Returns the currently open session for (user, server), or null */
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

/** Creates a new open session if none exists. No transactions. */
export async function connect(
  payload: { user_id: string; server_id: string },
  deps: CacheDeps = {}
): Promise<{ status: "created"; data: any } | { status: "conflict" }> {
  const { redis } = deps;
  const now = new Date();

  // Soft check first (fast path)
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
    await delKey(
      redis,
      CacheKeys.openByPair(payload.user_id, payload.server_id)
    );

    return { status: "created", data: created.toObject() };
  } catch (err: any) {
    // Handle race via unique index on (user_id, server_id, disconnected_at: null)
    if (err?.code === 11000) {
      return { status: "conflict" };
    }
    throw err;
  }
}

/** Closes the open session for (user, server) by setting disconnected_at=now. */
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
    await delKey(
      redis,
      CacheKeys.openByPair(payload.user_id, payload.server_id)
    );
    await delKey(redis, CacheKeys.byId(String(updatedDoc._id)));
    return updatedDoc.toObject(); // keep your service contract returning plain JSON
  }

  return null; // no open session found
}

export async function deleteConnectivity(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await ConnectivityModel.findByIdAndDelete(id);
  if (res) {
    await delKey(redis, CacheKeys.byId(String(id)));
    await bumpCollectionVersion(redis);
  }
  return !!res;
}
