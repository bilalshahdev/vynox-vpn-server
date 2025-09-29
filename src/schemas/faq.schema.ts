// src/schemas/faq.schema.ts
import { FromSchema } from "json-schema-to-ts";

const objectId = { type: "string", pattern: "^[0-9a-fA-F]{24}$" } as const;
const nonEmpty = { type: "string", minLength: 1 } as const;

export const paramsWithIdSchema = {
  type: "object",
  properties: { id: objectId },
  required: ["id"],
  additionalProperties: false,
} as const;

export const faqOut = {
  type: "object",
  properties: {
    _id: objectId,
    question: nonEmpty,
    slug: nonEmpty,
    answer: nonEmpty,
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
  required: ["_id", "question", "slug", "answer", "created_at", "updated_at"],
  additionalProperties: false,
} as const;

// GET /faqs (paginated)
export const listFaqsSchema = {
  querystring: {
    type: "object",
    properties: {
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
        data: { type: "array", items: faqOut },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromListFaqsQuery = FromSchema<typeof listFaqsSchema.querystring>;

// GET /faqs/search?q=
export const searchFaqsSchema = {
  querystring: {
    type: "object",
    properties: {
      q: { type: "string", minLength: 1 },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    },
    required: ["q"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: { type: "array", items: faqOut },
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromSearchFaqsQuery = FromSchema<
  typeof searchFaqsSchema.querystring
>;

// GET /faqs/:id
export const getFaqByIdSchema = {
  params: paramsWithIdSchema,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: faqOut },
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

// POST /faqs
export const createFaqSchema = {
  body: {
    type: "object",
    properties: {
      question: nonEmpty,
      answer: nonEmpty,
    },
    required: ["question", "answer"],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: { success: { type: "boolean" }, data: faqOut },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;
export type FromCreateFaqBody = FromSchema<typeof createFaqSchema.body>;

// PATCH /faqs/:id
export const updateFaqSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: {
      question: nonEmpty,
      answer: nonEmpty,
    },
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: faqOut },
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
export type FromUpdateFaqBody = FromSchema<typeof updateFaqSchema.body>;

export type FromParamsWithId = FromSchema<typeof paramsWithIdSchema>;
