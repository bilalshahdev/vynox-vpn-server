// src/schemas/country.schema.ts
import { FromSchema } from "json-schema-to-ts";

const iso2 = {
  type: "string",
  pattern: "^[A-Za-z]{2}$",
  minLength: 2,
  maxLength: 2,
} as const;
const nonEmpty = { type: "string", minLength: 1 } as const;

export const countryOut = {
  type: "object",
  properties: {
    _id: iso2,
    name: nonEmpty,
    slug: nonEmpty,
    flag: { type: "string" },
    country_code: { type: "string" },
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
  required: ["_id", "name", "slug", "created_at", "updated_at"],
  additionalProperties: false,
} as const;

// GET /countries  (paginated)
export const listCountriesSchema = {
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
        data: { type: "array", items: countryOut },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

// GET /countries/search?q=
export const searchCountriesSchema = {
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
        data: { type: "array", items: countryOut },
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export const countryIdParams = {
  type: "object",
  properties: { id: iso2 },
  required: ["id"],
  additionalProperties: false,
} as const;

// POST /countries
export const createCountrySchema = {
  body: {
    type: "object",
    properties: {
      _id: iso2, // ISO2 (e.g. "PK")
      name: nonEmpty,
      slug: nonEmpty,
      flag: { type: "string" }, // e.g. "pk.png"
      country_code: { type: "string" }, // optional
    },
    required: ["name", "slug", "flag", "country_code"],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: { success: { type: "boolean" }, data: countryOut },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export const updateCountrySchema = {
  params: countryIdParams,
  body: {
    type: "object",
    properties: {
      name: nonEmpty,
      slug: nonEmpty,
      flag: { type: "string" },
      country_code: { type: "string" },
    },
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: countryOut },
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

export type FromListCountriesQuery = FromSchema<
  typeof listCountriesSchema.querystring
>;
export type FromSearchCountriesQuery = FromSchema<
  typeof searchCountriesSchema.querystring
>;
export type FromCreateCountryBody = FromSchema<typeof createCountrySchema.body>;
export type FromUpdateCountryBody = FromSchema<typeof updateCountrySchema.body>;
export type FromCountryIdParams = FromSchema<typeof countryIdParams>;
