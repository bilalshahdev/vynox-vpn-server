// src/services/server.service.ts
import type Redis from "ioredis";
import { FilterQuery, UpdateQuery } from "mongoose";
import { ServerModel, IServer } from "../models/server.model";
import {
  CacheKeys,
  getCollectionVersion,
  bumpCollectionVersion,
  stableStringify,
  hashKey,
  getJSON,
  setJSON,
  del as delKey,
} from "../utils/cache";

export type ServerListFilter = {
  os_type?: "android" | "ios";
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number; // default 60
  idTtlSec?: number; // default 300
};

const DEFAULT_LIST_TTL = 60;
const DEFAULT_ID_TTL = 300;

// Helper: flag filename from country_code (frontend can prefix URL)
function flagOf(country_code?: string) {
  return country_code ? `${country_code.toLowerCase()}.png` : "";
}

// Transform DB doc -> flattened list item (without VPN configs)
function toListItem(doc: IServer & { _id: any }) {
  const g = doc.general;
  return {
    _id: String((doc as any)._id),
    name: g.name,
    categories: g.categories,
    country: g.country,
    country_code: g.country_code,
    flag: flagOf(g.country_code),
    city: g.city,
    is_pro: g.is_pro,
    mode: g.mode,
    ip: g.ip,
    latitude: g.latitude,
    longitude: g.longitude,
    os_type: g.os_type,
    created_at: (doc as any).created_at,
    updated_at: (doc as any).updated_at,
  };
}

// Transform DB doc -> flattened by-id item (includes VPN configs)
function toByIdItem(doc: IServer & { _id: any }) {
  const base = toListItem(doc);
  return {
    ...base,
    openvpn_config: doc.openvpn_config,
    wireguard_config: doc.wireguard_config,
  };
}

export async function listServers(
  filter: ServerListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  // Build DB query
  const q: FilterQuery<IServer> = {};
  if (filter.os_type) q["general.os_type"] = filter.os_type;

  // Cache key (versioned)
  const ver = await getCollectionVersion(redis);
  const keyPayload = { ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(keyPayload)));

  // Try cache
  const cached = await getJSON<unknown>(redis, listKey);
  if (cached) return cached;

  // DB hit
  const cursor = ServerModel.find(q)
    .lean()
    .sort({ "general.country": 1, "general.city": 1, created_at: -1 });

  const total = await ServerModel.countDocuments(q);
  const docs = await cursor.skip((page - 1) * limit).limit(limit);

  // Flatten and group by country
  const grouped = new Map<
    string,
    { country: string; country_code: string; flag: string; servers: any[] }
  >();
  for (const d of docs) {
    const item = toListItem(d as any);
    const key = item.country;
    if (!grouped.has(key)) {
      grouped.set(key, {
        country: item.country,
        country_code: item.country_code,
        flag: flagOf(item.country_code),
        servers: [],
      });
    }
    grouped.get(key)!.servers.push(item);
  }

  const data = Array.from(grouped.values());

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data,
  };

  // Cache
  await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function getServerById(id: string, deps: CacheDeps = {}) {
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const idKey = CacheKeys.byId(id);

  // Try cache (already transformed)
  const cached = await getJSON<any>(redis, idKey);
  if (cached) return cached;

  const doc = await ServerModel.findById(id).lean();
  if (!doc) return null;

  const shaped = toByIdItem(doc as any);

  await setJSON(redis, idKey, shaped, idTtlSec);
  return shaped;
}

export async function createServer(
  payload: Partial<IServer>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  // unique IP check
  const existing = await ServerModel.findOne({
    "general.ip": payload.general?.ip,
  });
  if (existing) {
    const error = new Error("IP already in use");
    (error as any).statusCode = 409;
    throw error;
  }

  const created = await ServerModel.create(payload as IServer);
  await bumpCollectionVersion(redis); // invalidate lists
  return created.toObject();
}

export async function updateServer(
  id: string,
  update: UpdateQuery<IServer>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await ServerModel.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean();

  if (doc) {
    await delKey(redis, CacheKeys.byId(id)); // drop transformed cache
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function setServerMode(
  id: string,
  mode: "test" | "live",
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await ServerModel.findByIdAndUpdate(
    id,
    { $set: { "general.mode": mode } },
    { new: true, runValidators: true }
  ).lean();

  if (doc) {
    await delKey(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function setServerIsPro(
  id: string,
  is_pro: boolean,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await ServerModel.findByIdAndUpdate(
    id,
    { $set: { "general.is_pro": is_pro } },
    { new: true, runValidators: true }
  ).lean();

  if (doc) {
    await delKey(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function updateOpenVPNConfig(
  id: string,
  cfg: { username?: string; password?: string; config?: string },
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await ServerModel.findByIdAndUpdate(
    id,
    {
      $set: {
        "openvpn_config.username": cfg.username,
        "openvpn_config.password": cfg.password,
        "openvpn_config.config": cfg.config,
      },
    },
    { new: true, runValidators: true }
  ).lean();

  if (doc) {
    await delKey(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function updateWireguardConfig(
  id: string,
  cfg: { address?: string; config?: string },
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await ServerModel.findByIdAndUpdate(
    id,
    {
      $set: {
        "wireguard_config.address": cfg.address,
        "wireguard_config.config": cfg.config,
      },
    },
    { new: true, runValidators: true }
  ).lean();

  if (doc) {
    await delKey(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function deleteServer(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await ServerModel.findByIdAndDelete(id);
  if (res) {
    await delKey(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return !!res;
}
