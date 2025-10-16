// src/services/country.service.ts
import type Redis from "ioredis";
import { CountryModel } from "../models/country.model";
import {
  CacheKeys,
  getCollectionVersion,
  getJSON,
  setJSON,
  hashKey,
  stableStringify,
  bumpCollectionVersion,
} from "../utils/cache";
import { CityModel } from "../models/city.model";
import { ServerModel } from "../models/server.model";
import { slugify, escapeRe } from "../utils/slugify";

type CacheDeps = { redis?: Redis; listTtlSec?: number; idTtlSec?: number };
const DEFAULT_LIST_TTL = 300;

export async function listCountries(
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;
  const ver = await getCollectionVersion(redis);
  const key = CacheKeys.list(
    ver,
    hashKey(stableStringify({ scope: "countries:list", page, limit }))
  );
  const cached = await getJSON<any>(redis, key);
  if (cached) return cached;

  const cursor = CountryModel.find().lean().sort({ slug: 1 });
  const total = await CountryModel.countDocuments();
  const items = await cursor.skip((page - 1) * limit).limit(limit);
  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: items,
  };
  await setJSON(redis, key, result, listTtlSec);
  return result;
}

export async function searchCountries(
  q: string,
  limit = 20,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;
  const ver = await getCollectionVersion(redis);
  const norm = slugify(q);
  const key = CacheKeys.list(
    ver,
    hashKey(stableStringify({ scope: "countries:search", q: norm, limit }))
  );
  const cached = await getJSON<any>(redis, key);
  if (cached) return cached;

  const or = [
    { slug: new RegExp("^" + escapeRe(norm)) },
    { name: new RegExp("^" + escapeRe(q), "i") },
    { _id: new RegExp("^" + escapeRe(q), "i") }, // ISO2
  ];
  const items = await CountryModel.find({ $or: or })
    .lean()
    .sort({ slug: 1 })
    .limit(limit);
  const result = { success: true, data: items };
  await setJSON(redis, key, result, listTtlSec);
  return result;
}

export async function createCountry(payload: any, deps: CacheDeps = {}) {
  const { redis } = deps;

  const doc = await CountryModel.create({
    _id: payload.country_code.toUpperCase(),
    ...payload,
  });
  await bumpCollectionVersion(redis);
  return doc.toObject();
}
export async function updateCountry(
  id: string,
  update: any,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await CountryModel.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean();
  if (doc) await bumpCollectionVersion(redis);
  return doc;
}
export async function deleteCountry(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;

  // First delete the country
  const res = await CountryModel.findByIdAndDelete(id);

  if (res) {
    // Cascade delete: all cities for this country
    await CityModel.deleteMany({ country_id: id });

    // Cascade delete: all servers for this country
    await ServerModel.deleteMany({ "general.country_code": id });

    await bumpCollectionVersion(redis);
  }
  return !!res;
}