// src/schemas/feedback.schema.ts
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
const objectId = { type: "string", pattern: "^[0-9a-fA-F]{24}$" } as const;

const feedbackOutSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    reason: { type: "string" },
    network_type: { type: "string" },
    requested_server: { type: "string" },
    server_id: objectId,
    rating: { type: "number", minimum: 1, maximum: 5 },
    review: { type: "string" },
    additional_data: { type: "object", additionalProperties: true },
    datetime: dateTime,
    created_at: dateTime,
    updated_at: dateTime,
  },
  required: [
    "_id",
    "reason",
    "network_type",
    "requested_server",
    "server_id",
    "rating",
    "review",
    "datetime",
    "created_at",
    "updated_at",
  ],
  additionalProperties: false,
} as const;

// ---------- List ----------
export const listFeedbackSchema = {
  querystring: {
    type: "object",
    properties: {
      server_id: objectId,
      reason: { type: "string" },
      network_type: { type: "string" },
      rating_min: { type: "integer", minimum: 1, maximum: 5 },
      rating_max: { type: "integer", minimum: 1, maximum: 5 },
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
        data: { type: "array", items: feedbackOutSchema },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromListFeedbackQuery = FromSchema<
  typeof listFeedbackSchema.querystring
>;

// ---------- Get by ID ----------
export const getFeedbackByIdSchema = {
  params: paramsWithIdSchema,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: feedbackOutSchema },
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

// ---------- Create ----------
export const createFeedbackSchema = {
  body: {
    type: "object",
    properties: {
      reason: { type: "string" },
      network_type: { type: "string" },
      requested_server: { type: "string" },
      server_id: objectId,
      rating: { type: "integer", minimum: 1, maximum: 5 },
      review: { type: "string" },
      additional_data: { type: "object", additionalProperties: true },
      datetime: dateTime,
    },
    required: [
      "reason",
      "network_type",
      "requested_server",
      "server_id",
      "rating",
      "review",
    ],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: { success: { type: "boolean" }, data: feedbackOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromCreateFeedbackBody = FromSchema<
  typeof createFeedbackSchema.body
>;
