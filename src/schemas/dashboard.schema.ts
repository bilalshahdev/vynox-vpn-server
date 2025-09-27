// src/schemas/dashboard.schema.ts
import { FromSchema } from "json-schema-to-ts";

const isoDate = { type: "string" } as const;

const reasonCountSchema = {
  type: "object",
  properties: { reason: { type: "string" }, count: { type: "integer" } },
  required: ["reason", "count"],
  additionalProperties: false,
} as const;

const activityItemSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["server", "connectivity", "feedback"] },
    title: { type: "string" },
    when: isoDate,
    ref_id: { type: "string" },
  },
  required: ["type", "title", "when", "ref_id"],
  additionalProperties: false,
} as const;

export const getDashboardSchema = {
  querystring: {
    type: "object",
    properties: {
      recent_limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
    },
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
            servers: {
              type: "object",
              properties: {
                total: { type: "integer" },
                by_os: {
                  type: "object",
                  properties: {
                    android: { type: "integer" },
                    ios: { type: "integer" },
                  },
                  required: ["android", "ios", "both"],
                  additionalProperties: false,
                },
                by_mode: {
                  type: "object",
                  properties: {
                    live: { type: "integer" },
                    test: { type: "integer" },
                  },
                  required: ["live", "test"],
                  additionalProperties: false,
                },
                pro: { type: "integer" },
              },
              required: ["total", "by_os", "by_mode", "pro"],
              additionalProperties: false,
            },
            connections: {
              type: "object",
              properties: {
                active: { type: "integer" },
                last_24h: { type: "integer" },
              },
              required: ["active", "last_24h"],
              additionalProperties: false,
            },
            feedback: {
              type: "object",
              properties: {
                last_7d: { type: "integer" },
                avg_rating_30d: { type: "number" },
                top_reasons_7d: { type: "array", items: reasonCountSchema },
              },
              required: ["last_7d", "avg_rating_30d", "top_reasons_7d"],
              additionalProperties: false,
            },
            ads: {
              type: "object",
              properties: {
                active: { type: "integer" },
                total: { type: "integer" },
              },
              required: ["active", "total"],
              additionalProperties: false,
            },
            recent_activity: { type: "array", items: activityItemSchema },
          },
          required: [
            "servers",
            "connections",
            "feedback",
            "ads",
            "recent_activity",
          ],
          additionalProperties: false,
        },
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromGetDashboardQuery = FromSchema<
  typeof getDashboardSchema.querystring
>;
