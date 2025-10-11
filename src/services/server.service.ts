// src/services/server.service.ts
import type Redis from "ioredis";
import { FilterQuery, UpdateQuery } from "mongoose";
import { IServer, ServerModel } from "../models/server.model";
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
import { FromSchema } from "json-schema-to-ts";

export type ServerListFilter = {
  os_type?: "android" | "ios";
  mode?: "test" | "live" | "off";
  search?: string;
};

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number;
  idTtlSec?: number;
};

const DEFAULT_LIST_TTL = 60;
const DEFAULT_ID_TTL = 300;

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

function toNullableConfig<T extends Record<string, any> | undefined | null>(
  cfg: T
) {
  if (!cfg) return null;
  const values = Object.values(cfg).filter(
    (v) => v !== undefined && v !== null && v !== ""
  );
  return values.length ? (cfg as any) : null;
}

function toByIdItem(doc: IServer & { _id: any }) {
  const base = toListItem(doc);
  return {
    ...base,
    openvpn_config: toNullableConfig(doc.openvpn_config),
    wireguard_config: toNullableConfig(doc.wireguard_config),
  };
}

function buildServerQuery(filter: ServerListFilter): FilterQuery<IServer> {
  const q: FilterQuery<IServer> = {};

  // OS filter
  if (filter.os_type) {
    q["general.os_type"] = filter.os_type;
  }

  // Mode filter (live | test | off)
  if (filter.mode) {
    q["general.mode"] = filter.mode;
  }

  // Search filter
  if (filter.search?.trim()) {
    const regex = new RegExp(filter.search.trim(), "i");
    q.$or = [
      { "general.name": regex },
      { "general.country": regex },
      { "general.city": regex },
      { "general.ip": regex },
    ];
  }

  return q;
}

export async function listServers(
  filter: ServerListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  const q = buildServerQuery(filter);

  // Cache key (versioned)
  const ver = await getCollectionVersion(redis);
  const keyPayload = { type: "list", ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(keyPayload)));

  // Try cache
  const cached = await getJSON<unknown>(redis, listKey);
  if (cached) {
    console.log("cache hit (list):", listKey);
    return cached;
  }

  // DB hit
  const cursor = ServerModel.find(q).lean().sort({ created_at: -1 });
  const total = await ServerModel.countDocuments(q);
  const docs = await cursor.skip((page - 1) * limit).limit(limit);

  const data = docs.map((d) => toListItem(d as any));

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data,
  };

  await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function listGroupedServers(
  filter: ServerListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  const q = buildServerQuery(filter);

  // Cache key (versioned)
  const ver = await getCollectionVersion(redis);
  const keyPayload = { type: "grouped", ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(keyPayload)));

  // Try cache
  const cached = await getJSON<unknown>(redis, listKey);
  if (cached) {
    console.log("cache hit (grouped):", listKey);
    return cached;
  }

  // DB hit
  const cursor = ServerModel.find(q)
    .lean()
    .sort({ "general.country": 1, "general.city": 1, created_at: -1 });

  const total = await ServerModel.countDocuments(q);
  const docs = await cursor.skip((page - 1) * limit).limit(limit);

  // Group by country
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

  // app-level guard (nice error), DB index is the final authority
  const existing = await ServerModel.findOne({
    "general.ip": payload.general?.ip,
    "general.os_type": payload.general?.os_type,
  }).lean();
  if (existing) {
    const error = new Error("IP already in use for this os_type");
    (error as any).statusCode = 409;
    throw error;
  }

  try {
    const created = await ServerModel.create(payload as IServer);
    await bumpCollectionVersion(redis);
    return created.toObject();
  } catch (e: any) {
    // surface duplicate key as 409
    if (e?.code === 11000 && /uniq_os_type_ip/.test(e?.message || "")) {
      const err = new Error("IP already in use for this os_type");
      (err as any).statusCode = 409;
      throw err;
    }
    throw e;
  }
}

export async function updateServer(
  id: string,
  update: UpdateQuery<IServer>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  // 1) normalize nested paths
  update = normalizeGeneralToSet(update);
  const $set = (update as any).$set || {};

  // 2) compute next (ip, os_type) pair to check
  const ipChanged = $set["general.ip"] != null;
  const osChanged = $set["general.os_type"] != null;

  if (ipChanged || osChanged) {
    const current = await ServerModel.findById(id).select({
      "general.ip": 1,
      "general.os_type": 1,
    });

    if (!current) {
      const err = new Error("Server not found");
      (err as any).statusCode = 404;
      throw err;
    }

    const nextIP = ipChanged ? String($set["general.ip"]) : current.general.ip;
    const nextOS = osChanged
      ? String($set["general.os_type"])
      : current.general.os_type;

    const conflict = await ServerModel.exists({
      _id: { $ne: id },
      "general.ip": nextIP,
      "general.os_type": nextOS,
    });
    if (conflict) {
      const err = new Error("IP already in use for this os_type");
      (err as any).statusCode = 409;
      throw err;
    }
  }

  try {
    const doc = await ServerModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
      context: "query",
    }).lean();

    if (doc) {
      await del(redis, CacheKeys.byId(id));
      await bumpCollectionVersion(redis);
    }
    return doc;
  } catch (e: any) {
    if (e?.code === 11000 && /uniq_os_type_ip/.test(e?.message || "")) {
      const err = new Error("IP already in use for this os_type");
      (err as any).statusCode = 409;
      throw err;
    }
    throw e;
  }
}

export async function setServerMode(
  id: string,
  mode: "test" | "live" | "off",
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const doc = await ServerModel.findByIdAndUpdate(
    id,
    { $set: { "general.mode": mode } },
    { new: true, runValidators: true }
  ).lean();

  if (doc) {
    await del(redis, CacheKeys.byId(id));
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
    await del(redis, CacheKeys.byId(id));
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

  const $set: Record<string, any> = {};
  if ("username" in cfg) $set["openvpn_config.username"] = cfg.username;
  if ("password" in cfg) $set["openvpn_config.password"] = cfg.password;
  if ("config" in cfg) $set["openvpn_config.config"] = cfg.config;

  const doc = await ServerModel.findByIdAndUpdate(
    id,
    Object.keys($set).length ? { $set } : {},
    { new: true, runValidators: true }
  ).lean();

  if (doc) {
    await del(redis, CacheKeys.byId(id));
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

  const $set: Record<string, any> = {};
  if ("address" in cfg) $set["wireguard_config.address"] = cfg.address;
  if ("config" in cfg) $set["wireguard_config.config"] = cfg.config;

  const doc = await ServerModel.findByIdAndUpdate(
    id,
    Object.keys($set).length ? { $set } : {},
    { new: true, runValidators: true }
  ).lean();

  if (doc) {
    await del(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return doc;
}

export async function deleteServer(id: string, deps: CacheDeps = {}) {
  const { redis } = deps;
  const res = await ServerModel.findByIdAndDelete(id);
  if (res) {
    await del(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);
  }
  return !!res;
}

function flagOf(country_code?: string) {
  return country_code ? `${country_code.toLowerCase()}.png` : "";
}

/** Normalize `general: { ... }` into `$set` to avoid overwriting the whole subdoc */
function normalizeGeneralToSet(update: UpdateQuery<IServer>) {
  const general = (update as any).general;
  if (general && typeof general === "object") {
    if (!(update as any).$set) (update as any).$set = {};
    for (const [k, v] of Object.entries(general)) {
      (update as any).$set[`general.${k}`] = v;
    }
    delete (update as any).general;
  }
  return update;
}
