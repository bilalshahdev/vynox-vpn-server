// /schemas/connectivity.schema.ts

import { FromSchema } from "json-schema-to-ts";

export const paramsWithIdSchema = {
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const dateTime = { type: "string", format: "date-time" } as const;
const dateTimeOrNull = { anyOf: [dateTime, { type: "null" }] } as const;

const connectivityOutSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    user_id: { type: "string" },
    server_id: { type: "string" },
    connected_at: dateTime,
    disconnected_at: dateTimeOrNull,
    created_at: dateTime,
    updated_at: dateTime,
  },
  required: [
    "_id",
    "user_id",
    "server_id",
    "connected_at",
    "disconnected_at",
    "created_at",
    "updated_at",
  ],
  additionalProperties: false,
} as const;

// ---------- Get by ID ----------
export const getConnectivityByIdSchema = {
  params: paramsWithIdSchema,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: connectivityOutSchema },
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

export type FromParamsWithId = FromSchema<typeof paramsWithIdSchema>;

// ---------- Connect (server timestamps, no transactions) ----------
export const connectSchema = {
  body: {
    type: "object",
    properties: {
      user_id: { type: "string" },
      server_id: { type: "string" },
    },
    required: ["user_id", "server_id"],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: { success: { type: "boolean" }, data: connectivityOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
    409: {
      type: "object",
      properties: { success: { type: "boolean" }, message: { type: "string" } },
      required: ["success", "message"],
      additionalProperties: false,
    },
  },
} as const;

export type FromConnectBody = FromSchema<typeof connectSchema.body>;

// ---------- Disconnect (by pair, server sets now) ----------
export const disconnectSchema = {
  body: {
    type: "object",
    properties: {
      user_id: { type: "string" },
      server_id: { type: "string" },
    },
    required: ["user_id", "server_id"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: connectivityOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
    409: {
      type: "object",
      properties: { success: { type: "boolean" }, message: { type: "string" } },
      required: ["success", "message"],
      additionalProperties: false,
    },
  },
} as const;

export type FromDisconnectBody = FromSchema<typeof disconnectSchema.body>;

// ---------- Open by pair (optional) ----------
export const openByPairQuerySchema = {
  querystring: {
    type: "object",
    properties: {
      user_id: { type: "string" },
      server_id: { type: "string" },
    },
    required: ["user_id", "server_id"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        // null if no open record
        data: { anyOf: [connectivityOutSchema, { type: "null" }] },
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromOpenByPairQuery = FromSchema<
  typeof openByPairQuerySchema.querystring
>;

// connectivity.schema.ts

export const serverWithActiveSchema = {
  params: {
    type: "object",
    properties: {
      server_id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
    },
    required: ["server_id"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            country: { type: "string" },
            city: { type: "string" },
            activeConnections: { type: "integer" },
          },
          required: ["_id", "name", "country", "city", "activeConnections"],
          additionalProperties: false,
        },
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

// connectivity.schema.ts
export const serversWithStatsSchema = {
  querystring: {
    type: "object",
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
      os_type: { type: "string", enum: ["android", "ios"] }, // ✅ new
      search: { type: "string" }, // ✅ new (matches city/country/name)
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
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              server: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  name: { type: "string" },
                  country: { type: "string" },
                  city: { type: "string" },
                  os_type: { type: "string", enum: ["android", "ios"] },
                },
                required: ["_id", "name", "country", "city", "os_type"],
                additionalProperties: true,
              },
              connections: {
                type: "object",
                properties: {
                  total: { type: "integer" },
                  active: { type: "integer" },
                },
                required: ["total", "active"],
                additionalProperties: false,
              },
            },
            required: ["server", "connections"],
            additionalProperties: false,
          },
        },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromServersWithStatsQuery = FromSchema<
  typeof serversWithStatsSchema.querystring
>;
