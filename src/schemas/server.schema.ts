// src/schemas/server.schema.ts
import { FromSchema } from "json-schema-to-ts";

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

const generalSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    categories: { type: "array", items: categoriesEnum, minItems: 1 },
    country: { type: "string" },
    city: { type: "string" },
    country_code: { type: "string" },
    is_pro: { type: "boolean" },
    mode: { type: "string", enum: ["test", "live"] },
    ip: { type: "string" },
    latitude: { type: "number" },
    longitude: { type: "number" },
    os_type: osType,
  },
  additionalProperties: false,
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
  required: ["_id", "general", "created_at", "updated_at"],
  additionalProperties: false,
} as const;

// ---------- List ----------
export const listServersSchema = {
  querystring: {
    type: "object",
    properties: {
      os_type: osType, // query-only OS filter
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    },
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        pagination: {
          type: "object",
          properties: {
            page: { type: "integer" },
            limit: { type: "integer" },
            total: { type: "integer" },
            pages: { type: "integer" },
          },
          required: ["page", "limit", "total", "pages"],
          additionalProperties: false,
        },
        data: { type: "array", items: serverOutSchema },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromListServersQuery = FromSchema<
  typeof listServersSchema.querystring
>;
// Removed: export type FromListServersByOSParams

// ---------- Get by ID ----------
export const getServerByIdSchema = {
  params: paramsWithIdSchema,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: serverOutSchema,
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
    404: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
      },
      required: ["success", "message"],
      additionalProperties: false,
    },
  },
} as const;

// ---------- Create ----------
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
          "city",
          "country_code",
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
      properties: {
        success: { type: "boolean" },
        data: serverOutSchema,
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromCreateServerBody = FromSchema<typeof createServerSchema.body>;

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
      properties: {
        success: { type: "boolean" },
        data: serverOutSchema,
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
    404: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
      },
      required: ["success", "message"],
      additionalProperties: false,
    },
  },
} as const;

export type FromUpdateServerBody = FromSchema<typeof updateServerSchema.body>;

// ---------- Mode ----------
export const updateServerModeSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["test", "live"] },
    },
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

export type FromUpdateModeBody = FromSchema<typeof updateServerModeSchema.body>;

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

export type FromUpdateIsProBody = FromSchema<
  typeof updateServerIsProSchema.body
>;

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

export type FromUpdateOpenVPNConfigBody = FromSchema<
  typeof updateOpenVPNConfigSchema.body
>;

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

export type FromUpdateWireguardConfigBody = FromSchema<
  typeof updateWireguardConfigSchema.body
>;

// ---------- Exports ----------
export type FromParamsWithId = FromSchema<typeof paramsWithIdSchema>;
