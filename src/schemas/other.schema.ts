// src/schemas/other.schema.ts

export const otherSchema = {
  params: {
    type: "object",
    required: ["ip"],
    properties: {
      ip: {
        type: "string",
        pattern: "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\\.|$)){4}$",
        description: "IP address of the server that is down",
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
    404: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
    500: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};
