// src/services/city.service.ts
import type Redis from "ioredis";
import { FilterQuery } from "mongoose";
import { CityModel, ICity } from "../models/city.model";
import { CountryModel, ICountry } from "../models/country.model";
import { IServer, ServerModel } from "../models/server.model";
import {
  bumpCollectionVersion,
  CacheKeys,
  getCollectionVersion,
  getJSON,
  hashKey,
  setJSON,
  stableStringify,
} from "../utils/cache";
import { escapeRe, slugify } from "../utils/slugify";

type CacheDeps = { redis?: Redis; listTtlSec?: number };
const DEFAULT_LIST_TTL = 300;

// ---------------- Get By ID ----------------
export async function getCityById(id: string) {
  // if you need the populated country: use lean generic + populate generic
  type CityWithCountry = Omit<ICity, "country"> & { country: ICountry };
  const city = await CityModel.findById(id)
    .populate<{ country: ICountry }>("country")
    .lean<CityWithCountry>();
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

  // NOTE: result is an array, type it as ICity[]
  const cursor = CityModel.find(q)
    .populate("country")
    .lean<ICity[]>()
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
    .lean<ICity[]>()
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
  // if you want populated country here:
  type CityWithCountry = Omit<ICity, "country"> & { country: ICountry };
  return CityModel.findById(doc._id)
    .populate<{ country: ICountry }>("country")
    .lean<CityWithCountry>();
}

// ---------------- Update ----------------
// IMPORTANT: we do NOT change schema; we just sync servers by matching strings.
export async function updateCity(
  id: string,
  update: Partial<{
    name: string;
    slug: string;
    state: string;
    country: string; // ISO2
    latitude: number;
    longitude: number;
  }>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  // 1) read BEFORE doc (to build precise filter for servers)
  const before = await CityModel.findById(id).lean<ICity>();
  if (!before) return null;

  // 2) normalize patch
  const $set: Partial<ICity> = {};
  if (update.name) $set.name = update.name;
  if (update.slug) $set.slug = update.slug;
  if (update.state) $set.state = update.state.toUpperCase();
  if (update.country) $set.country = update.country.toUpperCase();
  if (typeof update.latitude === "number") $set.latitude = update.latitude;
  if (typeof update.longitude === "number") $set.longitude = update.longitude;

  // 3) update the city
  const after = await CityModel.findByIdAndUpdate(
    id,
    { $set },
    { new: true, runValidators: true }
  ).lean<ICity>();
  if (!after) return null;

  // 4) read new country to project country name/flag
  const country = await CountryModel.findById(after.country).lean<ICountry>();
  // it's okay if no country doc (but ideally there is one)
  const newCountryName = country?.name ?? "";
  const newFlag = country?.flag ?? "";

  // 5) update servers that match the OLD city+country (string-based)
  const serverFilter: FilterQuery<IServer> = {
    "general.city": before.name,
    "general.country_code": before.country, // ISO2 from old city
  };

  const serverSet: Partial<IServer["general"]> = {
    city: after.name,
    country: newCountryName,
    flag: newFlag,
    country_code: after.country, // ISO2 (may have changed)
    latitude: after.latitude,
    longitude: after.longitude,
  };

  await ServerModel.updateMany(serverFilter, {
    $set: Object.fromEntries(
      Object.entries(serverSet).map(([k, v]) => [`general.${k}`, v])
    ),
  });

  await bumpCollectionVersion(redis);
  return after;
}

// ---------------- Delete ----------------
export async function deleteCity(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await CityModel.findByIdAndDelete(id);
  if (res) {
    // business rule: we won't delete servers; disable them
    await ServerModel.updateMany(
      { "general.city": res.name, "general.country_code": res.country },
      { $set: { "general.mode": "off" } }
    );
    await bumpCollectionVersion(redis);
  }
  return !!res;
}
