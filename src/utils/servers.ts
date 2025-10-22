import { FilterQuery } from "mongoose";
import { IServer } from "../models/server.model";

type ServerListFilter = {
  os_type?: "android" | "ios";
  mode?: "test" | "live" | "off";
  search?: string;
};

function flattenServer(serverDoc: any) {
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
        pipeline: [{ $project: { _id: 1, name: 1, flag: 1 } }],
      },
    },
    { $unwind: "$country" },

    {
      $lookup: {
        from: "cities",
        localField: "general.city_id",
        foreignField: "_id",
        as: "city",
        pipeline: [
          { $project: { _id: 1, name: 1, latitude: 1, longitude: 1 } },
        ],
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

export {
  ServerListFilter,
  flattenServer,
  buildServerAggPipeline,
  toNullableConfig,
  toByIdItem,
  buildServerQuery,
};
