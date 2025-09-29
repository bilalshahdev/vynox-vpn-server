// src/services/ad.service.ts
import type Redis from "ioredis";
import { FilterQuery, UpdateQuery } from "mongoose";
import { AdModel, IAd } from "../models/ad.model";
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

/** ---------- Service API ---------- */
export type AdListFilter = {
  os_type?: "android" | "ios"
  type?: string;
  position?: string;
  status?: boolean;
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number;
  idTtlSec?: number;
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
    await del(redis, CacheKeys.byId(id)); // drop per-id cache
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
    await del(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function deleteAd(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await AdModel.findByIdAndDelete(id);
  if (res) {
    await del(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return !!res;
}
