// src/services/feedback.service.ts
import crypto from "crypto";
import type Redis from "ioredis";
import { FilterQuery, Types } from "mongoose";
import { FeedbackModel, IFeedback } from "../models/feedback.model";

/** ---------------- Cache (scoped to feedback) ---------------- */
const NS = "v1:feedback";
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

/** ---------------- Service API ---------------- */
export type FeedbackListFilter = {
  server_id?: string;
  reason?: string;
  os_type?: "android" | "ios" | "both"; //
  rating?: number;
  from?: string;
  to?: string;
};

export type CreateFeedbackDTO = {
  reason: string;
  server_id: string;
  rating: number;
  review: string;
  os_type: "android" | "ios" | "both";
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number; // default 60
  idTtlSec?: number; // default 300
};

const DEFAULT_LIST_TTL = 60;
const DEFAULT_ID_TTL = 300;

function toObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    const err = new Error("Invalid server_id: must be a 24-hex Mongo ObjectId");
    (err as any).statusCode = 400;
    throw err;
  }
  return new Types.ObjectId(id);
}

export async function listFeedback(
  filter: FeedbackListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  const q: FilterQuery<IFeedback> = {};
  if (filter.server_id) q.server_id = toObjectId(filter.server_id);
  if (filter.reason) q.reason = filter.reason;
  if (filter.os_type) q.os_type = filter.os_type;
  if (filter.rating) q.rating = filter.rating;

  if (filter.from || filter.to) {
    q.datetime = {};
    if (filter.from) (q.datetime as any).$gte = new Date(filter.from);
    if (filter.rating != null) (q.rating as any).$lte = filter.rating;
  }
  if (filter.from || filter.to) {
    q.datetime = {};
    if (filter.from) (q.datetime as any).$gte = new Date(filter.from);
    if (filter.to) (q.datetime as any).$lte = new Date(filter.to);
  }

  const ver = await getCollectionVersion(redis);
  const payload = { ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(payload)));

  const cached = await getJSON<unknown>(redis, listKey);
  if (cached) return cached;

  const cursor = FeedbackModel.find(q)
    .lean()
    .sort({ datetime: -1, created_at: -1 });
  const total = await FeedbackModel.countDocuments(q);
  const items = await cursor.skip((page - 1) * limit).limit(limit);

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: items,
  };

  await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function getFeedbackById(id: string, deps: CacheDeps = {}) {
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const idKey = CacheKeys.byId(id);

  const cached = await getJSON<IFeedback>(redis, idKey);
  if (cached) return cached;

  const doc = await FeedbackModel.findById(id).lean();
  if (!doc) return null;

  await setJSON(redis, idKey, doc, idTtlSec);
  return doc;
}

export async function createFeedback(
  dto: CreateFeedbackDTO,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const created = await FeedbackModel.create({
    reason: dto.reason,
    server_id: toObjectId(dto.server_id),
    rating: dto.rating,
    review: dto.review,
    os_type: dto.os_type,
  });
  await bumpCollectionVersion(redis);
  return created.toObject();
}

export async function deleteFeedback(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await FeedbackModel.findByIdAndDelete(id);
  if (res) {
    await delKey(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return !!res;
}
