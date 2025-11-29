// src/schemas/server.schema.ts
import { FromSchema } from "json-schema-to-ts";
import { paginationSchema } from "./common";

const OS_VALUES = ["android", "ios"] as const;
const MODE_VALUES = ["test", "live", "off"] as const;
const CATEGORY_VALUES = ["gaming", "streaming"] as const;

const osType = { type: "string", enum: OS_VALUES } as const;
const modeEnum = { type: "string", enum: MODE_VALUES } as const;
const categoriesEnum = { type: "string", enum: CATEGORY_VALUES } as const;
const PROTOCOL_VALUES = ["openvpn", "wireguard", "xray"] as const;
const protocolEnum = { type: "string", enum: PROTOCOL_VALUES } as const;

// ---------- Shared ----------
export const paramsWithIdSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

export const deleteMultipleServersSchema = {
  body: {
    type: "object",
    properties: {
      ids: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
      },
    },
    required: ["ids"],
    additionalProperties: false,
  },
} as const;

export type FromDeleteMultipleServers = FromSchema<
  typeof deleteMultipleServersSchema.body
>;

const openvpnConfigSchema = {
  type: "object",
  properties: {
    username: { type: "string" },
    password: { type: "string" },
    config: { type: "string" },
  },
  additionalProperties: false,
} as const;

const wireguardConfigSchema = {
  type: "object",
  properties: {
    url: { type: "string" },
    api_token: { type: "string" },
  },
  additionalProperties: false,
} as const;

const xrayConfigSchema = {
  type: "object",
  properties: {
    shadowsocks: { type: "string" },
    vless: { type: "string" },
    vmess: { type: "string" },
    torjan: { type: "string" },
  },
  additionalProperties: false,
} as const;

/**
 * Flattened server shape (used for list items and by-id base)
 * This matches your public API response shape.
 */

const serverFlatBase = {
  type: "object",
  properties: {
    _id: { type: "string" },
    name: { type: "string" },
    categories: { type: "array", items: categoriesEnum, minItems: 1 },
    country_id: { type: "string" },
    country: { type: "string" },
    country_code: { type: "string" },
    flag: { type: "string" },
    city_id: { type: "string" },
    city: { type: "string" },
    is_pro: { type: "boolean" },
    mode: modeEnum,
    ip: { type: "string" },
    latitude: { type: "number" },
    longitude: { type: "number" },
    os_type: osType,

    // FIXED: strict enum
    protocol: protocolEnum,

    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
  required: [
    "_id",
    "name",
    "categories",
    "country",
    "country_code",
    "flag",
    "city",
    "is_pro",
    "mode",
    "ip",
    "latitude",
    "longitude",
    "os_type",
    // "protocol",
  ],
  additionalProperties: false,
} as const;

// List item = flattened server WITHOUT VPN configs
const serverListItemSchema = serverFlatBase;

// By-ID output = flattened server WITH optional VPN configs
const openvpnConfigOrNull = {
  anyOf: [openvpnConfigSchema, { type: "null" }],
} as const;
const wireguardConfigOrNull = {
  anyOf: [wireguardConfigSchema, { type: "null" }],
} as const;
const xrayConfigOrNull = {
  anyOf: [xrayConfigSchema, { type: "null" }],
} as const;

export const serverByIdOutSchema = {
  ...serverFlatBase,
  properties: {
    ...serverFlatBase.properties,
    openvpn_config: openvpnConfigOrNull,
    wireguard_config: wireguardConfigOrNull,
    xray_config: xrayConfigOrNull,
  },
} as const;

// ---------- List (grouped by country) ----------
const countryGroupSchema = {
  type: "object",
  properties: {
    country: { type: "string" },
    country_code: { type: "string" },
    flag: { type: "string" }, // e.g., "us.png"
    servers: { type: "array", items: serverListItemSchema },
  },
  required: ["country", "country_code", "flag", "servers"],
  additionalProperties: false,
} as const;

const querySchema = {
  type: "object",
  properties: {
    os_type: osType, // enum/schema for OS type
    mode: modeEnum, // enum/schema for mode
    protocol: protocolEnum, // ✅ added protocol
    page: {
      type: "integer",
      minimum: 1,
      default: 1,
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 200,
      default: 50,
    },
    search: {
      type: "string",
      minLength: 1,
    },
  },
  // required: ["os_type", "mode"],
  additionalProperties: false,
} as const;

function createListSchema(dataSchema: any) {
  return {
    querystring: querySchema,
    response: {
      200: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          pagination: paginationSchema,
          data: { type: "array", items: dataSchema },
        },
        required: ["success", "pagination", "data"],
        additionalProperties: false,
      },
    },
  } as const;
}

export const listServersSchema = createListSchema(serverListItemSchema);
export const listGroupedServersSchema = createListSchema(countryGroupSchema);

// ---------- Get by ID (flattened + configs) ----------
export const getServerByIdSchema = {
  params: paramsWithIdSchema,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: serverByIdOutSchema,
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
    404: {
      type: "object",
      properties: { success: { type: "boolean" }, message: { type: "string" } },
      required: ["success", "message"],
      additionalProperties: false,
    },
  },
} as const;

const generalInputSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    categories: { type: "array", items: categoriesEnum, minItems: 1 },
    country_id: { type: "string", description: "Country ISO2 (e.g., 'AU')" },
    city_id: { type: "string", description: "City ObjectId as string" },
    is_pro: { type: "boolean" },
    mode: modeEnum,
    ip: { type: "string" },
    os_type: osType,
  },
  additionalProperties: false,
} as const;

const serverDocOutSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    general: {
      ...generalInputSchema,
      required: [
        "name",
        "categories",
        "country_id",
        "city_id",
        "is_pro",
        "mode",
        "ip",
        "os_type",
      ],
    },
    openvpn_config: openvpnConfigOrNull,
    wireguard_config: wireguardConfigOrNull,
    xray_config: xrayConfigOrNull,
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
  required: ["_id", "general"],
  additionalProperties: false,
} as const;

// ---------- Create ----------
export const createServerSchema = {
  body: {
    type: "object",
    properties: {
      general: {
        ...generalInputSchema,
        required: [
          "name",
          "categories",
          "country_id",
          "city_id",
          "ip",
          "os_type",
        ],
      },
      openvpn_config: openvpnConfigSchema,
      wireguard_config: wireguardConfigSchema,
      xray_config: xrayConfigSchema,
    },
    required: ["general"],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: serverDocOutSchema, // returns doc with IDs (recommended for admin)
        // data: serverByIdOutSchema, // uncomment if you want flattened output here too
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ---------- Update (partial) ----------
export const updateServerSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: {
      general: {
        ...generalInputSchema,
        required: [
          "name",
          "categories",
          "country_id",
          "city_id",
          "ip",
          "os_type",
          "is_pro",
          "mode",
        ],
      },
      openvpn_config: openvpnConfigSchema,
      wireguard_config: wireguardConfigSchema,
      xray_config: xrayConfigSchema,
    },
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: serverDocOutSchema, // returns doc with IDs (recommended for admin)
        // data: serverByIdOutSchema, // uncomment if you want flattened output here too
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
    404: {
      type: "object",
      properties: { success: { type: "boolean" }, message: { type: "string" } },
      required: ["success", "message"],
      additionalProperties: false,
    },
  },
} as const;

// ---------- Mode ----------
export const updateServerModeSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: { mode: modeEnum },
    required: ["mode"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: serverDocOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ---------- Is Pro ----------
export const updateServerIsProSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: { is_pro: { type: "boolean" } },
    required: ["is_pro"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: serverDocOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ---------- OpenVPN Config ----------
export const updateOpenVPNConfigSchema = {
  params: paramsWithIdSchema,
  body: {
    ...openvpnConfigSchema,
    minProperties: 1,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: serverDocOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ---------- WireGuard Config ----------
export const updateWireguardConfigSchema = {
  params: paramsWithIdSchema,
  body: {
    ...wireguardConfigSchema,
    minProperties: 1,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: serverDocOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ---------- XRay Config ----------
export const updateXRayConfigSchema = {
  params: paramsWithIdSchema,
  body: {
    ...xrayConfigSchema,
    minProperties: 1,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: serverDocOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ---------- Create Multiple ----------
export const createMultipleServersSchema = {
  body: {
    type: "array",
    items: createServerSchema.body, // reuse
    minItems: 1,
  } as const,
  response: {
    201: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "array",
          items: serverDocOutSchema,
        },
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ---------- Server Down ----------
export const serverDownSchema = {
  params: {
    type: "object",
    required: ["ip"],
    properties: {
      ip: {
        type: "string",
        pattern: "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\\.|$)){4}$",
        description: "IP address of the server that is down",
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: { message: { type: "string" } },
    },
    404: {
      type: "object",
      properties: { message: { type: "string" } },
    },
    500: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
} as const;

export const serverStatusSchema = {
  params: {
    type: "object",
    properties: {
      ip: { type: "string", description: "Target server IP address" },
    },
    required: ["ip"],
  },
  response: {
    200: {
      description: "Stream of server status data",
      type: "object",
      properties: {
        clients: { type: "number" },
        speed: {
          type: "object",
          properties: {
            download_speed: { type: "string" },
            upload_speed: { type: "string" },
          },
        },
        total_usage: {
          type: "object",
          properties: {
            received: { type: "string" },
            sent: { type: "string" },
          },
        },
        ram: {
          type: "object",
          properties: {
            total: { type: "string" },
            used: { type: "string" },
            percentage: { type: "number" },
          },
        },
        cpu: {
          type: "object",
          properties: {
            percentage: { type: "number" },
          },
        },
        server_actual: {
          type: "object",
          properties: {
            download_speed: { type: "string" },
            upload_speed: { type: "string" },
          },
        },
      },
    },
  },
};

// ---------- Types ----------
export type FromCreateMultipleServersBody = FromSchema<
  typeof createMultipleServersSchema.body
>;
export type FromListServersQuery = FromSchema<typeof querySchema>;
export type FromCreateServerBody = FromSchema<typeof createServerSchema.body>;
export type FromUpdateServerBody = FromSchema<typeof updateServerSchema.body>;
export type FromUpdateModeBody = FromSchema<typeof updateServerModeSchema.body>;
export type FromUpdateIsProBody = FromSchema<
  typeof updateServerIsProSchema.body
>;
export type FromUpdateOpenVPNConfigBody = FromSchema<
  typeof updateOpenVPNConfigSchema.body
>;
export type FromUpdateWireguardConfigBody = FromSchema<
  typeof updateWireguardConfigSchema.body
>;
export type FromUpdateXRayConfigBody = FromSchema<
  typeof updateXRayConfigSchema.body
>;
export type FromParamsWithId = FromSchema<typeof paramsWithIdSchema>;
