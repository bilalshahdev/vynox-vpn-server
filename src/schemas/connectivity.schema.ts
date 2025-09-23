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

// ---------- List ----------
export const listConnectivitySchema = {
  querystring: {
    type: "object",
    properties: {
      user_id: { type: "string" },
      server_id: { type: "string" },
      from: dateTime,
      to: dateTime,
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
        data: { type: "array", items: connectivityOutSchema },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromListConnectivityQuery = FromSchema<
  typeof listConnectivitySchema.querystring
>;

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

export type FromOpenByPairQuery = FromSchema<typeof openByPairQuerySchema.querystring>;
