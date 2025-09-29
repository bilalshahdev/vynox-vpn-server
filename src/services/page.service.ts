// src/services/page.service.ts
import crypto from "crypto";
import type Redis from "ioredis";
import { FilterQuery, Types, UpdateQuery } from "mongoose";
import { IPage, PageModel } from "../models/page.model";
import {
  bumpCollectionVersion,
  CacheKeys,
  getCollectionVersion,
  getJSON,
  hashKey,
  setJSON,
  stableStringify,
  del
} from "../utils/cache";

type PageLean = Pick<IPage, "type"> & { _id: string };

/** ---------- Service API ---------- */
export type PageListFilter = {
  type?: string;
  title?: string;
  q?: string; 
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number; 
  idTtlSec?: number; 
  typeTtlSec?: number; 
};

const DEFAULT_LIST_TTL = 60;
const DEFAULT_ID_TTL = 300;
const DEFAULT_TYPE_TTL = 300;

export async function listPages(
  filter: PageListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  const q: FilterQuery<IPage> = {};
  if (filter.type) q.type = filter.type;
  if (filter.title) q.title = new RegExp(filter.title, "i");
  if (filter.q) {
    const rx = new RegExp(filter.q, "i");
    q.$or = [{ type: rx }, { title: rx }, { description: rx }];
  }

  const ver = await getCollectionVersion(redis);
  const keyPayload = { ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(keyPayload)));

  const cached = await getJSON<unknown>(redis, listKey);
  if (cached) return cached;

  const cursor = PageModel.find(q).lean().sort({ created_at: -1, type: 1 });
  const total = await PageModel.countDocuments(q);
  const items = await cursor.skip((page - 1) * limit).limit(limit);

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: items,
  };

  await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function getPageById(id: string, deps: CacheDeps = {}) {
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const key = CacheKeys.byId(id);

  const cached = await getJSON<IPage>(redis, key);
  if (cached) return cached;

  const doc = await PageModel.findById(id).lean<IPage | null>();
  if (!doc) return null;

  await setJSON(redis, key, doc, idTtlSec);
  return doc;
}

export async function getPageByType(type: string, deps: CacheDeps = {}) {
  const { redis, typeTtlSec = DEFAULT_TYPE_TTL } = deps;
  const key = CacheKeys.byType(type);

  const cached = await getJSON<IPage>(redis, key);
  if (cached) return cached;

  const doc = await PageModel.findOne({ type }).lean<IPage | null>();
  if (!doc) return null;

  await setJSON(redis, key, doc, typeTtlSec);
  return doc;
}

export async function createPage(
  payload: { type: string; title: string; description: string },
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const normType = payload.type.trim().toLowerCase();

  // preflight check to provide clean 409 and avoid duplicate inserts in race-free majority cases
  const already = await PageModel.exists({ type: normType });
  if (already) {
    const err: any = new Error("A page with this type already exists.");
    err.statusCode = 409;
    throw err;
  }

  try {
    const created = await PageModel.create({
      ...payload,
      type: normType, // setter would do it anyway, but being explicit helps readability
    } as IPage);

    await bumpCollectionVersion(redis);
    await del(redis, CacheKeys.byType(created.type)); // normalized
    return created.toObject();
  } catch (err: any) {
    if (err?.code === 11000) {
      err.statusCode = 409;
      err.message = "A page with this type already exists.";
    }
    throw err;
  }
}

function normalizeType(v: unknown) {
  return typeof v === "string" ? v.trim().toLowerCase() : undefined;
}

function applyNormalizedType(update: UpdateQuery<IPage>) {
  // Capture any incoming 'type' from either direct path or $set
  const raw =
    (update as any).type ?? ((update as any).$set && (update as any).$set.type);

  const next = normalizeType(raw);
  if (!next) return undefined;

  // Write it back so DB receives normalized value
  if ((update as any).type !== undefined) (update as any).type = next;
  if ((update as any).$set?.type !== undefined)
    (update as any).$set.type = next;

  return next;
}
export async function updatePage(
  id: string,
  update: UpdateQuery<IPage>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  try {
    const before = await PageModel.findById(id).lean<PageLean | null>();
    if (!before) return null;

    // Normalize incoming type (if provided)
    const nextType = applyNormalizedType(update);

    // Preflight: if changing type, ensure uniqueness (excluding this doc)
    if (nextType && nextType !== before.type) {
      const exists = await PageModel.exists({
        type: nextType,
        _id: { $ne: new Types.ObjectId(id) },
      });
      if (exists) {
        const err: any = new Error("A page with this type already exists.");
        err.statusCode = 409;
        throw err;
      }
    }

    const doc = await PageModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      context: "query",
    }).lean<PageLean | null>();

    if (doc) {
      await del(redis, CacheKeys.byId(id));
      if (before?.type) await del(redis, CacheKeys.byType(before.type));
      if (doc.type) await del(redis, CacheKeys.byType(doc.type));
      await bumpCollectionVersion(redis);
    }
    return doc;
  } catch (err: any) {
    // Final guard if a race sneaks past the preflight
    if (err?.code === 11000) {
      err.statusCode = 409;
      err.message = "A page with this type already exists.";
    }
    throw err;
  }
}

export async function deletePage(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const doc = await PageModel.findByIdAndDelete(id).lean<PageLean | null>();
  if (doc) {
    await del(redis, CacheKeys.byId(id));
    if (doc.type) await del(redis, CacheKeys.byType(doc.type));
    await bumpCollectionVersion(redis);
  }
  return !!doc;
}
