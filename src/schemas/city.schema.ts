import { FromSchema } from "json-schema-to-ts";
import { countryOut } from "./country.schema"; // ✅ reuse existing country schema

const nonEmpty = { type: "string", minLength: 1 } as const;
const objectId = { type: "string", pattern: "^[0-9a-fA-F]{24}$" } as const;

// ----------------- City Out -----------------
export const cityOut = {
  type: "object",
  properties: {
    _id: objectId,
    name: nonEmpty,
    slug: nonEmpty,
    state: nonEmpty,
    country: countryOut,
    latitude: { type: "number", minimum: -90, maximum: 90 },
    longitude: { type: "number", minimum: -180, maximum: 180 },
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
  required: [],
  additionalProperties: false,
} as const;

// ----------------- List -----------------
export const listCitiesSchema = {
  querystring: {
    type: "object",
    properties: {
      country: {
        type: "string",
        pattern: "^[A-Za-z]{2}$",
        minLength: 2,
        maxLength: 2,
      }, // 👈 add country (ISO2)
      state: { type: "string", minLength: 1, maxLength: 10 },
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    },
    required: [],
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
        data: { type: "array", items: cityOut },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ----------------- Search -----------------
export const searchCitiesSchema = {
  querystring: {
    type: "object",
    properties: {
      q: { type: "string", minLength: 1 },
      country: {
        type: "string",
        pattern: "^[A-Za-z]{2}$",
        minLength: 2,
        maxLength: 2,
      }, // 👈 add country (ISO2)
      state: { type: "string", minLength: 1, maxLength: 10 },
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
        data: { type: "array", items: cityOut },
      },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ----------------- Params -----------------
export const cityIdParams = {
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

// ----------------- Get By ID -----------------
export const getCityByIdSchema = {
  params: cityIdParams,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: cityOut },
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

// ----------------- Create -----------------
export const createCitySchema = {
  body: {
    type: "object",
    properties: {
      name: nonEmpty,
      slug: nonEmpty,
      state: nonEmpty,
      country: { type: "string", pattern: "^[A-Za-z]{2}$" }, // 👈 input just ISO2
      latitude: { type: "number", minimum: -90, maximum: 90 },
      longitude: { type: "number", minimum: -180, maximum: 180 },
    },
    required: ["name", "slug", "state", "country", "latitude", "longitude"],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: { success: { type: "boolean" }, data: cityOut },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

// ----------------- Update -----------------
export const updateCitySchema = {
  params: cityIdParams,
  body: {
    type: "object",
    properties: {
      name: nonEmpty,
      slug: nonEmpty,
      state: nonEmpty,
      country: { type: "string", pattern: "^[A-Za-z]{2}$" }, // 👈 update also accepts ISO2
      latitude: { type: "number", minimum: -90, maximum: 90 },
      longitude: { type: "number", minimum: -180, maximum: 180 },
    },
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: cityOut },
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

// ----------------- Types -----------------
export type FromCreateCityBody = FromSchema<typeof createCitySchema.body>;
export type FromUpdateCityBody = FromSchema<typeof updateCitySchema.body>;
export type FromCityIdParams = FromSchema<typeof cityIdParams>;
export type FromListCitiesQuery = FromSchema<
  typeof listCitiesSchema.querystring
>;
export type FromSearchCitiesQuery = FromSchema<
  typeof searchCitiesSchema.querystring
>;
