// src/utils/cache.ts
import crypto from "crypto";
import type Redis from "ioredis";

const NS = "v1:servers"; // namespace for this module

export const CacheKeys = {
  ver: () => `${NS}:ver`,
  list: (ver: string, hash: string) => `${NS}:${ver}:list:${hash}`,
  byId: (id: string) => `${NS}:id:${id}`,
  openByPair: (u: string, s: string) => `${NS}:open:${u}:${s}`,
  byName: (name: string) => `${NS}:name:${name}`,
  byType: (type: string) => `${NS}:type:${type}`,
};

export async function getCollectionVersion(redis?: Redis): Promise<string> {
  if (!redis) return "0";
  const v = await redis.get(CacheKeys.ver());
  if (v) return v;
  await redis.set(CacheKeys.ver(), "1");
  return "1";
}

export async function bumpCollectionVersion(redis?: Redis): Promise<void> {
  if (!redis) return;
  await redis.incr(CacheKeys.ver());
}

// Shallow stable stringify for flat objects (sufficient for query filters)
export function stableStringify(obj: Record<string, unknown>) {
  const keys = Object.keys(obj).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = (obj as any)[k];
  return JSON.stringify(ordered);
}

export function hashKey(input: string) {
  return crypto.createHash("sha1").update(input).digest("hex");
}

export async function getJSON<T>(
  redis: Redis | undefined,
  key: string
): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // be resilient to Redis issues
  }
}

export async function setJSON(
  redis: Redis | undefined,
  key: string,
  value: unknown,
  ttlSec: number
) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    // swallow errors; never break the request because cache failed
  }
}

export async function del(redis: Redis | undefined, key: string) {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
}
