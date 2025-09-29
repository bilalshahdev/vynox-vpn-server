// src/services/feedback.service.ts
import type Redis from "ioredis";
import { FilterQuery } from "mongoose";
import { FeedbackModel, IFeedback } from "../models/feedback.model";
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
import { validateMongoId } from "../utils/validateMongoId";

/** ---------------- Service API ---------------- */
export type FeedbackListFilter = {
  server_id?: string;
  reason?: string;
  os_type?: "android" | "ios" 
  network_type?: "wifi" | "mobile";
  rating?: number;
  from?: string; // ISO date
  to?: string; // ISO date
};

export type CreateFeedbackDTO = {
  reason: string;
  server_id: string;
  review: string;
  os_type: "android" | "ios"
  rating?: number; // now optional
  network_type?: "wifi" | "mobile";
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number; // default 60
  idTtlSec?: number; // default 300
};

const DEFAULT_LIST_TTL = 60;
const DEFAULT_ID_TTL = 300;

export async function listFeedback(
  filter: FeedbackListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  const q: FilterQuery<IFeedback> = {};
  if (filter.server_id) q.server_id = validateMongoId(filter.server_id);
  if (filter.reason) q.reason = filter.reason;
  if (filter.os_type) q.os_type = filter.os_type;
  if (filter.network_type) (q as any).network_type = filter.network_type; // new
  if (typeof filter.rating === "number") q.rating = filter.rating;

  if (filter.from || filter.to) {
    q.datetime = {};
    if (filter.from) (q.datetime as any).$gte = new Date(filter.from);
    if (filter.to) (q.datetime as any).$lte = new Date(filter.to);
  }

  const cursor = FeedbackModel.find(q).lean().sort({ datetime: -1, _id: -1 });

  const ver = await getCollectionVersion(redis);
  const payload = { ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(payload)));

  const cached = await getJSON<unknown>(redis, listKey);
  if (cached) return cached;

  // const cursor = FeedbackModel.find(q).lean().sort({ created_at: -1, _id: -1 });

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

  const payload: Partial<IFeedback> = {
    reason: dto.reason,
    server_id: validateMongoId(dto.server_id),
    review: dto.review,
    os_type: dto.os_type,
  };

  if (typeof dto.rating === "number") payload.rating = dto.rating; // optional
  if (dto.network_type) (payload as any).network_type = dto.network_type; // new

  const created = await FeedbackModel.create(payload);
  await bumpCollectionVersion(redis);
  return created.toObject();
}

export async function deleteFeedback(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await FeedbackModel.findByIdAndDelete(id);
  if (res) {
    await del(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return !!res;
}
