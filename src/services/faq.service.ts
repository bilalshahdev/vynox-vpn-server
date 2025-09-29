// src/services/faq.service.ts
import type Redis from "ioredis";
import { UpdateQuery } from "mongoose";
import { FaqModel, IFaq } from "../models/faq.model";
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

type CacheDeps = { redis?: Redis; listTtlSec?: number; idTtlSec?: number };
const DEFAULT_LIST_TTL = 300;
const DEFAULT_ID_TTL = 300;

export async function listFaqs(page = 1, limit = 50, deps: CacheDeps = {}) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;
  const ver = await getCollectionVersion(redis);
  const key = CacheKeys.list(
    ver,
    hashKey(stableStringify({ scope: "faq:list", page, limit }))
  );
  const cached = await getJSON<any>(redis, key);
  if (cached) return cached;

  const cursor = FaqModel.find().lean().sort({ created_at: -1, _id: -1 });
  const total = await FaqModel.countDocuments();
  const items = await cursor.skip((page - 1) * limit).limit(limit);

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: items,
  };
  await setJSON(redis, key, result, listTtlSec);
  return result;
}

export async function searchFaqs(q: string, limit = 20, deps: CacheDeps = {}) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;
  const ver = await getCollectionVersion(redis);
  const norm = slugify(q);
  const key = CacheKeys.list(
    ver,
    hashKey(stableStringify({ scope: "faq:search", q: norm, limit }))
  );
  const cached = await getJSON<any>(redis, key);
  if (cached) return cached;

  const or = [
    { slug: new RegExp("^" + escapeRe(norm)) },
    { question: new RegExp(escapeRe(q), "i") },
  ];

  const items = await FaqModel.find({ $or: or })
    .lean()
    .sort({ created_at: -1 })
    .limit(limit);
  const result = { success: true, data: items };
  await setJSON(redis, key, result, listTtlSec);
  return result;
}

export async function getFaqById(id: string, deps: CacheDeps = {}) {
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const idKey = CacheKeys.byId(id);
  const cached = await getJSON<IFaq>(redis, idKey);
  if (cached) return cached;

  const doc = await FaqModel.findById(id).lean();
  if (!doc) return null;

  await setJSON(redis, idKey, doc, idTtlSec);
  return doc;
}

export async function createFaq(
  payload: { question: string; answer: string },
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const base = slugify(payload.question);
  const slug = await generateUniqueSlug(base);

  const created = await FaqModel.create({
    question: payload.question,
    slug,
    answer: payload.answer,
  } as Partial<IFaq>);

  await bumpCollectionVersion(redis);
  return created.toObject();
}

export async function updateFaq(
  id: string,
  update: UpdateQuery<IFaq> & { question?: string; answer?: string },
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const $set: any = {};
  if (update.question) {
    $set.question = update.question;
    const base = slugify(update.question);
    $set.slug = await generateUniqueSlug(base, id);
  }
  if (update.answer) $set.answer = update.answer;

  const doc = await FaqModel.findByIdAndUpdate(
    id,
    { $set },
    { new: true, runValidators: true }
  ).lean();

  if (doc) {
    await del(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function deleteFaq(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await FaqModel.findByIdAndDelete(id);
  if (res) {
    await del(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return !!res;
}

// ----- helpers (local to service) -----
function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ensure unique slug; when updating, exclude current id
async function generateUniqueSlug(base: string, excludeId?: string) {
  const re = new RegExp("^" + escapeRe(base) + "(?:-(\\d+))?$");
  const query: any = { slug: re };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await FaqModel.find(query, { slug: 1 }).lean();
  if (!existing.length) return base;

  let max = 1;
  for (const d of existing) {
    const m = d.slug.match(re);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (n >= max) max = n + 1;
    } else {
      // plain base exists
      if (max === 1) max = 2;
    }
  }
  return `${base}-${max}`;
}
