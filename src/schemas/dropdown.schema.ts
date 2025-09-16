// src/schemas/dropdown.schema.ts
import { FromSchema } from "json-schema-to-ts";

export const paramsWithIdSchema = {
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const dropdownValueSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    value: { type: "string", minLength: 1 },
  },
  required: ["name", "value"],
  additionalProperties: false,
} as const;

const dropdownOutSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    name: { type: "string" },
    values: { type: "array", items: dropdownValueSchema },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  },
  required: ["_id", "name", "values", "created_at", "updated_at"],
  additionalProperties: false,
} as const;

// ---------- List ----------
export const listDropdownsSchema = {
  querystring: {
    type: "object",
    properties: {
      name: { type: "string" },
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
        data: { type: "array", items: dropdownOutSchema },
      },
      required: ["success", "pagination", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromListDropdownsQuery = FromSchema<
  typeof listDropdownsSchema.querystring
>;

// ---------- Get by ID ----------
export const getDropdownByIdSchema = {
  params: paramsWithIdSchema,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: dropdownOutSchema },
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

// ---------- Get by Name ----------
export const getDropdownByNameSchema = {
  params: {
    type: "object",
    properties: { name: { type: "string", minLength: 1 } },
    required: ["name"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: dropdownOutSchema },
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

export type FromGetByNameParams = FromSchema<
  typeof getDropdownByNameSchema.params
>;

// ---------- Create ----------
export const createDropdownSchema = {
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1 },
      values: { type: "array", items: dropdownValueSchema },
    },
    required: ["name"],
    additionalProperties: false,
  } as const,
  response: {
    201: {
      type: "object",
      properties: { success: { type: "boolean" }, data: dropdownOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
  },
} as const;

export type FromCreateDropdownBody = FromSchema<
  typeof createDropdownSchema.body
>;

// ---------- Update (partial) ----------
export const updateDropdownSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1 },
      values: { type: "array", items: dropdownValueSchema },
    },
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: dropdownOutSchema },
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

export type FromUpdateDropdownBody = FromSchema<
  typeof updateDropdownSchema.body
>;

// ---------- Add value ----------
export const addDropdownValueSchema = {
  params: paramsWithIdSchema,
  body: dropdownValueSchema,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: dropdownOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
    409: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
      additionalProperties: false,
    },
  },
} as const;

export type FromAddDropdownValueBody = FromSchema<
  typeof addDropdownValueSchema.body
>;

// ---------- Update value ----------
export const updateDropdownValueSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: {
      old_value: { type: "string", minLength: 1 },
      new_name: { type: "string", minLength: 1 },
      new_value: { type: "string", minLength: 1 },
    },
    required: ["old_value"],
    additionalProperties: false,
    anyOf: [{ required: ["new_name"] }, { required: ["new_value"] }],
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: dropdownOutSchema },
      required: ["success", "data"],
      additionalProperties: false,
    },
    404: {
      type: "object",
      properties: { success: { type: "boolean" }, message: { type: "string" } },
      required: ["success", "message"],
      additionalProperties: false,
    },
    409: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
      additionalProperties: false,
    },
  },
} as const;

export type FromUpdateDropdownValueBody = FromSchema<
  typeof updateDropdownValueSchema.body
>;

// ---------- Remove value ----------
export const removeDropdownValueSchema = {
  params: paramsWithIdSchema,
  body: {
    type: "object",
    properties: { value: { type: "string", minLength: 1 } },
    required: ["value"],
    additionalProperties: false,
  } as const,
  response: {
    200: {
      type: "object",
      properties: { success: { type: "boolean" }, data: dropdownOutSchema },
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

export type FromRemoveDropdownValueBody = FromSchema<
  typeof removeDropdownValueSchema.body
>;
