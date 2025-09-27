// src/services/ad.service.ts
import crypto from "crypto";
import type Redis from "ioredis";
import { FilterQuery, UpdateQuery } from "mongoose";
import { AdModel, IAd } from "../models/ad.model";

/** ---------- Cache helpers (scoped to Ads) ---------- */
const NS = "v1:ads";
const CacheKeys = {
  ver: () => `${NS}:ver`,
  list: (ver: string, hash: string) => `${NS}:${ver}:list:${hash}`,
  byId: (id: string) => `${NS}:id:${id}`,
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

/** ---------- Service API ---------- */
export type AdListFilter = {
  os_type?: "android" | "ios" | "both";
  type?: string;
  position?: string;
  status?: boolean;
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number; // default 60
  idTtlSec?: number; // default 300
};

const DEFAULT_LIST_TTL = 60;
const DEFAULT_ID_TTL = 300;

export async function listAds(
  filter: AdListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  const q: FilterQuery<IAd> = {};
  if (filter.os_type) q.os_type = filter.os_type;
  if (filter.type) q.type = filter.type;
  if (filter.position) q.position = filter.position;
  if (typeof filter.status === "boolean") q.status = filter.status;

  // versioned list key
  const ver = await getCollectionVersion(redis);
  const keyPayload = { ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(keyPayload)));

  const cached = await getJSON<unknown>(redis, listKey);
  if (cached) return cached;

  const cursor = AdModel.find(q).lean().sort({ position: 1, created_at: -1 });
  const total = await AdModel.countDocuments(q);
  const items = await cursor.skip((page - 1) * limit).limit(limit);

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: items,
  };

  await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function getAdById(id: string, deps: CacheDeps = {}) {
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const idKey = CacheKeys.byId(id);

  const cached = await getJSON<IAd>(redis, idKey);
  if (cached) return cached;

  const doc = await AdModel.findById(id).lean();
  if (!doc) return null;

  await setJSON(redis, idKey, doc, idTtlSec);
  return doc;
}

export async function createAd(payload: Partial<IAd>, deps: CacheDeps = {}) {
  const { redis } = deps;
  const existing = await AdModel.findOne({
    ad_id: payload.ad_id,
  });

  const error = new Error("ad_id already in use");
  (error as any).statusCode = 409;
  if (existing) throw error;
  const created = await AdModel.create(payload as IAd);
  await bumpCollectionVersion(redis); // invalidate lists
  return created.toObject();
}

export async function updateAd(
  id: string,
  update: UpdateQuery<IAd>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await AdModel.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean();

  if (doc) {
    await delKey(redis, CacheKeys.byId(id)); // drop per-id cache
    await bumpCollectionVersion(redis); // invalidate lists
  }
  return doc;
}

export async function setAdStatus(
  id: string,
  status: boolean,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await AdModel.findByIdAndUpdate(
    id,
    { $set: { status } },
    { new: true, runValidators: true }
  ).lean();

  if (doc) {
    await delKey(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function deleteAd(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await AdModel.findByIdAndDelete(id);
  if (res) {
    await delKey(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return !!res;
}
