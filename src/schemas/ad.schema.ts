// src/schemas/ad.schema.ts
import { FromSchema } from "json-schema-to-ts";

// ---------- Shared ----------
export const paramsWithIdSchema = {
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

// Keep OS as compile-time enum.
const osType = { type: "string", enum: ["android", "ios"] } as const;

// For server-driven dropdowns: just require non-empty strings.
const nonEmptyString = { type: "string", minLength: 1 } as const;

const adOutSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    type: nonEmptyString,
    position: nonEmptyString,
    status: { type: "boolean" },
    ad_id: { type: "string" },
    os_type: osType,
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
  required: [
    "_id",
    "type",
    "position",
    "status",
    "os_type",
    "created_at",
    "updated_at",
  ],
  additionalProperties: false,
} as const;

// ---------- List ----------
export const listAdsSchema = {
  querystring: {
    type: "object",
    properties: {
      os_type: osType,
      type: nonEmptyString, // string (optional)
      position: nonEmptyString, // string (optional)
      status: { type: "boolean" },
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
        data: { type: "array", items: adOutSchema },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromListAdsQuery = FromSchema<typeof listAdsSchema.querystring>;

// ---------- Get by ID ----------
export const getAdByIdSchema = {
  params: paramsWithIdSchema,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: adOutSchema },
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

// ---------- Create ----------
export const createAdSchema = {
  body: {
    type: "object",
    properties: {
      type: nonEmptyString, // string required
      position: nonEmptyString, // string required
      status: { type: "boolean" },
      ad_id: nonEmptyString, // keep non-empty constraint
      os_type: osType,
    },
    required: ["type", "position", "os_type"],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: { success: { type: "boolean" }, data: adOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromCreateAdBody = FromSchema<typeof createAdSchema.body>;

// ---------- Update ----------
export const updateAdSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: {
      type: nonEmptyString, // string (optional)
      position: nonEmptyString, // string (optional)
      status: { type: "boolean" },
      ad_id: nonEmptyString,
      os_type: osType,
    },
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: adOutSchema },
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

export type FromUpdateAdBody = FromSchema<typeof updateAdSchema.body>;

// ---------- Update Status ----------
export const updateAdStatusSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: { status: { type: "boolean" } },
    required: ["status"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: adOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromUpdateAdStatusBody = FromSchema<
  typeof updateAdStatusSchema.body
>;

// ---------- Exports ----------
export type FromParamsWithId = FromSchema<typeof paramsWithIdSchema>;
