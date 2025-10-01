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

// ---------------- Get By ID ----------------
export async function getCityById(id: string) {
  const city = await CityModel.findById(id).populate("country").lean();
  if (!city) return null;
  return { success: true, data: city };
}

// ---------------- List ----------------
export async function listCities(
  filter: { country?: string; state?: string },
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
  if (filter.country) q.country = filter.country.toUpperCase();
  if (filter.state) q.state = filter.state.toUpperCase();

  const cursor = CityModel.find(q)
    .populate("country")
    .lean()
    .sort({ country: 1, state: 1, slug: 1 });

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

// ---------------- Search ----------------
export async function searchCities(
  filter: { q: string; country?: string; state?: string },
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
        c: filter.country?.toUpperCase(),
        s: filter.state?.toUpperCase(),
        limit,
      })
    )
  );
  const cached = await getJSON<any>(redis, key);
  if (cached) return cached;

  const q: FilterQuery<ICity> = {};
  if (filter.country) q.country = filter.country.toUpperCase();
  if (filter.state) q.state = filter.state.toUpperCase();

  const or = [
    { slug: new RegExp("^" + escapeRe(norm)) },
    { name: new RegExp("^" + escapeRe(filter.q), "i") },
  ];

  const items = await CityModel.find({ ...q, $or: or })
    .populate("country")
    .lean()
    .sort({ country: 1, state: 1, slug: 1 })
    .limit(limit);

  const result = { success: true, data: items };
  await setJSON(redis, key, result, listTtlSec);
  return result;
}

// ---------------- Create ----------------
export async function createCity(
  payload: {
    name: string;
    slug: string;
    state: string;
    country: string; // ISO2
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
    country: payload.country.toUpperCase(),
    latitude: payload.latitude,
    longitude: payload.longitude,
  } as any);

  await bumpCollectionVersion(redis);
  return CityModel.findById(doc._id).populate("country").lean();
}

// ---------------- Update ----------------
export async function updateCity(
  id: string,
  update: Partial<{
    name: string;
    slug: string;
    state: string;
    country: string;
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
  if (update.country) $set.country = update.country.toUpperCase();
  if (typeof update.latitude === "number") $set.latitude = update.latitude;
  if (typeof update.longitude === "number") $set.longitude = update.longitude;

  const doc = await CityModel.findByIdAndUpdate(
    id,
    { $set },
    { new: true, runValidators: true }
  )
    .populate("country")
    .lean();

  if (doc) await bumpCollectionVersion(redis);
  return doc;
}

// ---------------- Delete ----------------
export async function deleteCity(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await CityModel.findByIdAndDelete(id);
  if (res) await bumpCollectionVersion(redis);
  return !!res;
}

// ---------------- Helpers ----------------
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
