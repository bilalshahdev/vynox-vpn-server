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

function flattenServer(serverDoc: any) {
  console.log({ serverDoc });
  if (!serverDoc) return null;

  const country = serverDoc.country;
  const city = serverDoc.city;
  return {
    _id: serverDoc._id.toString(),
    name: serverDoc.general.name,
    categories: serverDoc.general.categories,
    country_id: country._id,
    country: country?.name ?? "",
    country_code: country?._id ?? "",
    flag: country?.flag ?? "",
    city_id: city._id,
    city: city?.name ?? "",
    is_pro: serverDoc.general.is_pro,
    mode: serverDoc.general.mode,
    ip: serverDoc.general.ip,
    latitude: city?.latitude ?? serverDoc.general.latitude ?? 0,
    longitude: city?.longitude ?? serverDoc.general.longitude ?? 0,
    os_type: serverDoc.general.os_type,
    created_at: serverDoc.created_at.toISOString(),
    updated_at: serverDoc.updated_at.toISOString(),
  };
}

function buildServerAggPipeline(filter: ServerListFilter) {
  const q = buildServerQuery(filter);
  const pipeline: any[] = [
    { $match: q },
    {
      $lookup: {
        from: "countries",
        localField: "general.country_id",
        foreignField: "_id",
        as: "country",
      },
    },
    { $unwind: "$country" },
    {
      $lookup: {
        from: "cities",
        localField: "general.city_id",
        foreignField: "_id",
        as: "city",
      },
    },
    { $unwind: "$city" },
  ];

  if (filter.search) {
    const regex = new RegExp(filter.search, "i");
    pipeline.push({
      $match: {
        $or: [
          { "general.name": regex },
          { "city.name": regex },
          { "country.name": regex },
        ],
      },
    });
  }

  return pipeline;
}

function applyPagination(pipeline: any[], page: number, limit: number) {
  pipeline.push({ $sort: { created_at: -1 } });
  pipeline.push({ $skip: (page - 1) * limit });
  pipeline.push({ $limit: limit });
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
  const country = doc.general.country_id;
  const city = doc.general.city_id;
  const base = flattenServer({ ...doc, country, city });
  return {
    ...base,
    openvpn_config: toNullableConfig(doc.openvpn_config),
    wireguard_config: toNullableConfig(doc.wireguard_config),
  };
}

function buildServerQuery(filter: ServerListFilter): FilterQuery<IServer> {
  const q: FilterQuery<IServer> = {};

  if (filter.os_type) {
    q["general.os_type"] = filter.os_type;
  }

  if (filter.mode) {
    if (filter.mode === "test") {
      q["general.mode"] = { $in: ["live", "test", "off"] };
    } else {
      q["general.mode"] = filter.mode;
    }
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

  const ver = await getCollectionVersion(redis);
  const keyPayload = { type: "list", ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(keyPayload)));

  if (redis) {
    const cached = await getJSON(redis, listKey);
    if (cached) return cached;
  }

  const pipeline = buildServerAggPipeline(filter);

  // Count total
  const countPipeline = [
    ...pipeline.filter((s) => !("$skip" in s || "$limit" in s)),
  ];
  countPipeline.push({ $count: "total" });
  const countResult = await ServerModel.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  applyPagination(pipeline, page, limit);
  const serversAgg = await ServerModel.aggregate(pipeline);
  const data = serversAgg.map(flattenServer);

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data,
  };

  if (redis) await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function listGroupedServers(
  filter: ServerListFilter,
  page = 1,
  limit = 50,
  deps: CacheDeps = {}
) {
  const { redis, listTtlSec = DEFAULT_LIST_TTL } = deps;

  const ver = await getCollectionVersion(redis);
  const keyPayload = { type: "grouped", ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(keyPayload)));

  if (redis) {
    const cached = await getJSON(redis, listKey);
    if (cached) return cached;
  }

  const pipeline = buildServerAggPipeline(filter);
  applyPagination(pipeline, 1, 1000); // fetch all for grouping

  const serversAgg = await ServerModel.aggregate(pipeline);
  const grouped: Record<string, any> = {};

  serversAgg.forEach((s) => {
    const key = s.country._id;
    if (!grouped[key]) {
      grouped[key] = {
        country: s.country.name,
        country_code: s.country._id,
        flag: s.country.flag,
        servers: [],
      };
    }
    grouped[key].servers.push(flattenServer(s));
  });

  const groupedArray = Object.values(grouped);
  const total = groupedArray.length;
  const paginated = groupedArray.slice((page - 1) * limit, page * limit);

  const result = {
    success: true,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    data: paginated,
  };

  if (redis) await setJSON(redis, listKey, result, listTtlSec);
  return result;
}

export async function getServerById(id: string, deps: CacheDeps = {}) {
  console.log("heyyy");
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const idKey = CacheKeys.byId(id);

  // Try cache (already transformed)
  const cached = await getJSON<any>(redis, idKey);
  // if (cached) return cached;

  const serverDoc = await ServerModel.findById(id)
    .populate("general.country_id")
    .populate("general.city_id")
    .lean();
  if (!serverDoc) return null;

  const shaped = toByIdItem(serverDoc as any);

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
