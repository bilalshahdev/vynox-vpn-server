// src/services/country.service.ts
import type Redis from "ioredis";
import { CityModel } from "../models/city.model";
import { CountryModel, ICountry } from "../models/country.model";
import { ServerModel } from "../models/server.model";
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

  const cursor = CountryModel.find().lean<ICountry[]>().sort({ slug: 1 });
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
    { _id: new RegExp("^" + escapeRe(q), "i") },
  ];
  const items = await CountryModel.find({ $or: or })
    .lean<ICountry[]>()
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
  update: Partial<Pick<ICountry, "name" | "slug" | "flag">>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  // 1) Update the country (do not change _id here)
  const country = await CountryModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  ).lean<ICountry>();
  if (!country) return null;

  // 2) Push denormalized fields to servers
  await ServerModel.updateMany(
    { "general.country_code": country._id },
    {
      $set: {
        "general.country": country.name,
        "general.flag": country.flag ?? "",
      },
    }
  );

  await bumpCollectionVersion(redis);
  return country;
}

export async function deleteCountry(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;

  const res = await CountryModel.findByIdAndDelete(id);

  if (res) {
    await CityModel.deleteMany({ country: id });
    await ServerModel.deleteMany({ "general.country_code": id });

    await bumpCollectionVersion(redis);
  }
  return !!res;
}
