// src/services/server.service.ts
import type Redis from "ioredis";
import mongoose, { UpdateQuery } from "mongoose";
import { ConnectivityModel } from "../models/connectivity.model";
import { FeedbackModel } from "../models/feedback.model";
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
import {
  buildServerAggPipeline,
  flattenServer,
  ServerListFilter,
  toByIdItem,
} from "../utils/servers";

type CacheDeps = {
  redis?: Redis;
  listTtlSec?: number;
  idTtlSec?: number;
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
  const ver = await getCollectionVersion(redis);
  const keyPayload = { type: "list", ...filter, page, limit };
  const listKey = CacheKeys.list(ver, hashKey(stableStringify(keyPayload)));

  if (redis) {
    const cached = await getJSON(redis, listKey);
    if (cached) return cached;
  }

  const pipeline = buildServerAggPipeline(filter);

  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [
        { $sort: { created_at: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ],
    },
  });

  const [aggResult] = await ServerModel.aggregate(pipeline);

  const total = aggResult?.metadata?.[0]?.total || 0;
  const data = aggResult?.data.map(flattenServer);
  const pages = Math.max(1, Math.ceil(total / limit));

  const result = {
    success: true,
    pagination: { page, limit, total, pages },
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
  const { redis, idTtlSec = DEFAULT_ID_TTL } = deps;
  const idKey = CacheKeys.byId(id);

  const cached = await getJSON<any>(redis, idKey);
  if (cached) return cached;

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
  
  update = normalizeGeneralToSet(update);
  const $set = (update as any).$set || {};

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
  cfg: { url?: string; api_token?: string },
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  const $set: Record<string, any> = {};
  if ("url" in cfg) $set["wireguard_config.url"] = cfg.url;
  if ("api_token" in cfg) $set["wireguard_config.api_token"] = cfg.api_token;

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

export async function updateXRayConfig(
  id: string,
  cfg: {
    shadowsocks?: string;
    vless?: string;
    vmess?: string;
    torjan?: string;
  },
  deps: CacheDeps = {}
) {
  const { redis } = deps;

  const $set: Record<string, any> = {};
  if ("shadowsocks" in cfg) $set["xray_config.shadowsocks"] = cfg.shadowsocks;
  if ("vless" in cfg) $set["xray_config.vless"] = cfg.vless;
  if ("vmess" in cfg) $set["xray_config.vmess"] = cfg.vmess;
  if ("torjan" in cfg) $set["xray_config.torjan"] = cfg.torjan;

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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const server = await ServerModel.findByIdAndDelete(id, { session });
    if (!server) {
      await session.abortTransaction();
      session.endSession();
      return false;
    }

    await Promise.all([
      ConnectivityModel.deleteMany({ server_id: id }, { session }),
      FeedbackModel.deleteMany({ server_id: id }, { session }),
    ]);

    await session.commitTransaction();
    session.endSession();

    await del(redis, CacheKeys.byId(id));
    await bumpCollectionVersion(redis);

    return true;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Delete server failed:", error);
    return false;
  }
}

export async function deleteMultipleServers(
  ids: string[],
  deps: CacheDeps = {}
) {
  const { redis } = deps;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const servers = await ServerModel.deleteMany(
      { _id: { $in: ids } },
      { session }
    );
    if (!servers.deletedCount) {
      await session.abortTransaction();
      session.endSession();
      return false;
    }

    await Promise.all([
      ConnectivityModel.deleteMany({ server_id: { $in: ids } }, { session }),
      FeedbackModel.deleteMany({ server_id: { $in: ids } }, { session }),
    ]);

    await session.commitTransaction();
    session.endSession();

    await Promise.all(ids.map((id) => del(redis, CacheKeys.byId(id))));
    await bumpCollectionVersion(redis);

    return true;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Bulk delete servers failed:", error);
    return false;
  }
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
