// src/services/page.service.ts
import crypto from "crypto";
import type Redis from "ioredis";
import { FilterQuery, UpdateQuery } from "mongoose";
import { IPage, PageModel } from "../models/page.model";

/** ---------- Cache helpers (scoped to Pages) ---------- */
const NS = "v1:pages";
const CacheKeys = {
  ver: () => `${NS}:ver`,
  list: (ver: string, hash: string) => `${NS}:${ver}:list:${hash}`,
  byId: (id: string) => `${NS}:id:${id}`,
  byType: (type: string) => `${NS}:type:${type}`,
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

// Minimal lean shape we need for invalidation
type PageLean = Pick<IPage, "type"> & { _id: string };

/** ---------- Service API ---------- */
export type PageListFilter = {
  type?: string;
  title?: string;
  q?: string; // generic contains filter across type/title/description
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number; // default 60
  idTtlSec?: number; // default 300
  typeTtlSec?: number; // default 300
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
  try {
    const created = await PageModel.create(payload as IPage);
    // invalidate lists; also nuke potential stale type key (shouldn't exist due to unique, but safe)
    await bumpCollectionVersion(redis);
    await delKey(redis, CacheKeys.byType(payload.type));
    return created.toObject();
  } catch (err: any) {
    if (err?.code === 11000) {
      err.statusCode = 409;
      err.message = "A page with this type already exists.";
    }
    throw err;
  }
}

export async function updatePage(
  id: string,
  update: UpdateQuery<IPage>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  try {
    const before = await PageModel.findById(id).lean<PageLean | null>();
    const doc = await PageModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean<PageLean | null>();

    if (doc) {
      await delKey(redis, CacheKeys.byId(id));
      if (before?.type) await delKey(redis, CacheKeys.byType(before.type));
      if (doc.type) await delKey(redis, CacheKeys.byType(doc.type));
      await bumpCollectionVersion(redis);
    }
    return doc;
  } catch (err: any) {
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
    await delKey(redis, CacheKeys.byId(id));
    if (doc.type) await delKey(redis, CacheKeys.byType(doc.type));
    await bumpCollectionVersion(redis);
  }
  return !!doc;
}
