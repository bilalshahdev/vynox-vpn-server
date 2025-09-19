export const paginationSchema = {
  type: "object",
  properties: {
    page: { type: "integer" },
    limit: { type: "integer" },
    total: { type: "integer" },
    pages: { type: "integer" },
  },
  required: ["page", "limit", "total", "pages"],
  additionalProperties: false,
} as const;
