// src/services/city.service.ts
import type Redis from "ioredis";
import { FilterQuery } from "mongoose";
import { CityModel, ICity } from "../models/city.model";
import {
  CacheKeys,
  getCollectionVersion,
  getJSON,
  setJSON,
  hashKey,
  stableStringify,
  bumpCollectionVersion,
} from "../utils/cache";

type CacheDeps = { redis?: Redis; listTtlSec?: number };
const DEFAULT_LIST_TTL = 300;

export async function listCities(
  filter: { country_id?: string; state?: string },
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;
  const ver = await getCollectionVersion(redis);
  const key = CacheKeys.list(
    ver,
    hashKey(stableStringify({ scope: "cities:list", ...filter, page, limit }))
  );
  const cached = await getJSON<any>(redis, key);
  if (cached) return cached;

  const q: FilterQuery<ICity> = {};
  if (filter.country_id) q.country_id = filter.country_id.toUpperCase();
  if (filter.state) q.state = filter.state.toUpperCase();

  const cursor = CityModel.find(q)
    .lean()
    .sort({ country_id: 1, state: 1, slug: 1 });
  const total = await CityModel.countDocuments(q);
  const items = await cursor.skip((page - 1) * limit).limit(limit);

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: items,
  };
  await setJSON(redis, key, result, listTtlSec);
  return result;
}

export async function searchCities(
  filter: { q: string; country_id?: string; state?: string },
  limit = 20,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;
  const ver = await getCollectionVersion(redis);
  const norm = slugify(filter.q);
  const key = CacheKeys.list(
    ver,
    hashKey(
      stableStringify({
        scope: "cities:search",
        q: norm,
        c: filter.country_id?.toUpperCase(),
        s: filter.state?.toUpperCase(),
        limit,
      })
    )
  );
  const cached = await getJSON<any>(redis, key);
  if (cached) return cached;

  const q: FilterQuery<ICity> = {};
  if (filter.country_id) q.country_id = filter.country_id.toUpperCase();
  if (filter.state) q.state = filter.state.toUpperCase();

  const or = [
    { slug: new RegExp("^" + escapeRe(norm)) },
    { name: new RegExp("^" + escapeRe(filter.q), "i") },
  ];

  const items = await CityModel.find({ ...q, $or: or })
    .lean()
    .sort({ country_id: 1, state: 1, slug: 1 })
    .limit(limit);

  const result = { success: true, data: items };
  await setJSON(redis, key, result, listTtlSec);
  return result;
}

export async function createCity(
  payload: {
    name: string;
    slug: string;
    state: string;
    country_id: string;
    latitude: number;
    longitude: number;
  },
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await CityModel.create({
    name: payload.name,
    slug: payload.slug,
    state: payload.state.toUpperCase(),
    country_id: payload.country_id.toUpperCase(),
    latitude: payload.latitude,
    longitude: payload.longitude,
  } as any);
  await bumpCollectionVersion(redis);
  return doc.toObject();
}

export async function updateCity(
  id: string,
  update: Partial<{
    name: string;
    slug: string;
    state: string;
    country_id: string;
    latitude: number;
    longitude: number;
  }>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const $set: any = {};
  if (update.name) $set.name = update.name;
  if (update.slug) $set.slug = update.slug;
  if (update.state) $set.state = update.state.toUpperCase();
  if (update.country_id) $set.country_id = update.country_id.toUpperCase();
  if (
    typeof update.latitude === "number" &&
    typeof update.longitude === "number"
  )
    $set.loc = {
      type: "Point",
      coordinates: [update.longitude, update.latitude],
    };

  const doc = await CityModel.findByIdAndUpdate(
    id,
    { $set },
    { new: true, runValidators: true }
  ).lean();
  if (doc) await bumpCollectionVersion(redis);
  return doc;
}

export async function deleteCity(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await CityModel.findByIdAndDelete(id);
  if (res) await bumpCollectionVersion(redis);
  return !!res;
}

// helpers
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
