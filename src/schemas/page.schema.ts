// src/schemas/page.schema.ts
import { FromSchema } from "json-schema-to-ts";

export const paramsWithIdSchema = {
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const pageOutSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    type: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  },
  required: ["_id", "type", "title", "description", "created_at", "updated_at"],
  additionalProperties: false,
} as const;

// ---------- List ----------
export const listPagesSchema = {
  querystring: {
    type: "object",
    properties: {
      type: { type: "string", minLength: 1 },
      title: { type: "string", minLength: 1 },
      q: { type: "string", minLength: 1 },
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
        data: { type: "array", items: pageOutSchema },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromListPagesQuery = FromSchema<typeof listPagesSchema.querystring>;

// ---------- Get by ID ----------
export const getPageByIdSchema = {
  params: paramsWithIdSchema,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: pageOutSchema },
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

// ---------- Get by Type ----------
export const getPageByTypeSchema = {
  params: {
    type: "object",
    properties: { type: { type: "string", minLength: 1 } },
    required: ["type"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: pageOutSchema },
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

export type FromGetByTypeParams = FromSchema<typeof getPageByTypeSchema.params>;

// ---------- Create ----------
export const createPageSchema = {
  body: {
    type: "object",
    properties: {
      type: { type: "string", minLength: 1 },
      title: { type: "string", minLength: 1 },
      description: { type: "string", minLength: 1 },
    },
    required: ["type", "title", "description"],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: { success: { type: "boolean" }, data: pageOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromCreatePageBody = FromSchema<typeof createPageSchema.body>;

// ---------- Update (partial) ----------
export const updatePageSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: {
      type: { type: "string", minLength: 1 },
      title: { type: "string", minLength: 1 },
      description: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: pageOutSchema },
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

export type FromUpdatePageBody = FromSchema<typeof updatePageSchema.body>;
