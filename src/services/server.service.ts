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

  // Build cache key (versioned)
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
  const items = await cursor.skip((page - 1) * limit).limit(limit);

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: items,
  };

  // Cache
  await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function getServerById(id: string, deps: CacheDeps = {}) {
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const idKey = CacheKeys.byId(id);

  const cached = await getJSON<IServer>(redis, idKey);
  if (cached) return cached;

  const doc = await ServerModel.findById(id).lean();
  if (!doc) return null;

  await setJSON(redis, idKey, doc, idTtlSec);
  return doc;
}

export async function createServer(
  payload: Partial<IServer>,
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const created = await ServerModel.create(payload as IServer);
  // Invalidate list caches (version bump)
  await bumpCollectionVersion(redis);
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
    // delete per-id cache, bump list version
    await delKey(redis, CacheKeys.byId(id));
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
