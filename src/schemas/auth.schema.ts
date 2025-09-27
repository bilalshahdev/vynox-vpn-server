import { FromSchema } from "json-schema-to-ts";

export const loginSchema = {
  body: {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6 },
    },
    required: ["email", "password"],
    additionalProperties: false,
  },
} as const;

export type LoginSchema = FromSchema<typeof loginSchema.body>;
