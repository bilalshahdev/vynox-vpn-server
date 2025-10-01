// src/schemas/server.schema.ts
import { FromSchema } from "json-schema-to-ts";
import { paginationSchema } from "./common";

// ---------- Shared ----------
export const paramsWithIdSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const osType = { type: "string", enum: ["android", "ios"] } as const;
const categoriesEnum = {
  type: "string",
  enum: ["gaming", "streaming"],
} as const;

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
    address: { type: "string" },
    config: { type: "string" },
  },
  additionalProperties: false,
} as const;

/**
 * Flattened server shape (used for list items and by-id base)
 * NOTE: list items exclude VPN configs; by-id includes them optionally.
 */
const serverFlatBase = {
  type: "object",
  properties: {
    _id: { type: "string" },
    name: { type: "string" },
    categories: { type: "array", items: categoriesEnum, minItems: 1 },
    country: { type: "string" },
    country_code: { type: "string" },
    flag: { type: "string" }, // e.g., "us.png" (frontend can prefix)
    city: { type: "string" },
    is_pro: { type: "boolean" },
    mode: { type: "string", enum: ["test", "live"] },
    ip: { type: "string" },
    latitude: { type: "number" },
    longitude: { type: "number" },
    os_type: osType,
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
  ],
  additionalProperties: false,
} as const;

// List item = flattened server WITHOUT VPN configs
const serverListItemSchema = serverFlatBase;

// By-ID output = flattened server WITH optional VPN configs
const serverByIdOutSchema = {
  ...serverFlatBase,
  properties: {
    ...serverFlatBase.properties,
    openvpn_config: openvpnConfigSchema,
    wireguard_config: wireguardConfigSchema,
  },
  // VPN configs remain optional
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

// Shared query schema
const querySchema = {
  type: "object",
  properties: {
    os_type: osType,
    mode: { type: "string", enum: ["test", "live"] },
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    search: { type: "string" },
  },
  additionalProperties: false,
} as const;

// Factory function to build list schema
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

// Now just call with the right data shape
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

// ---------- Create (keep as-is; returns full server doc shape if you prefer) ----------
const generalSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    categories: { type: "array", items: categoriesEnum, minItems: 1 },
    country: { type: "string" },
    country_code: { type: "string" },
    flag: { type: "string" },
    city: { type: "string" },
    is_pro: { type: "boolean" },
    mode: { type: "string", enum: ["test", "live"] },
    ip: { type: "string" },
    latitude: { type: "number" },
    longitude: { type: "number" },
    os_type: osType,
  },
  additionalProperties: false,
} as const;

const serverOutSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    general: {
      ...generalSchema,
      required: [
        "name",
        "categories",
        "country",
        "city",
        "country_code",
        "is_pro",
        "mode",
        "ip",
        "latitude",
        "longitude",
        "os_type",
      ],
    },
    openvpn_config: openvpnConfigSchema,
    wireguard_config: wireguardConfigSchema,
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
  required: ["_id", "general"],
  additionalProperties: false,
} as const;

export const createServerSchema = {
  body: {
    type: "object",
    properties: {
      general: {
        ...generalSchema,
        required: [
          "name",
          "categories",
          "country",
          "country_code",
          "flag",
          "city",
          "ip",
          "latitude",
          "longitude",
          "os_type",
        ],
      },
      openvpn_config: openvpnConfigSchema,
      wireguard_config: wireguardConfigSchema,
    },
    required: ["general"],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: { success: { type: "boolean" }, data: serverOutSchema },
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
      general: generalSchema,
      openvpn_config: openvpnConfigSchema,
      wireguard_config: wireguardConfigSchema,
    },
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: serverOutSchema },
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
    properties: { mode: { type: "string", enum: ["test", "live"] } },
    required: ["mode"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: serverOutSchema },
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
      properties: { success: { type: "boolean" }, data: serverOutSchema },
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
      properties: { success: { type: "boolean" }, data: serverOutSchema },
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
      properties: { success: { type: "boolean" }, data: serverOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

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

export type FromParamsWithId = FromSchema<typeof paramsWithIdSchema>;
