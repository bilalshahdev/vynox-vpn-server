// src/api/v1/routes/other.routes.ts
import { FastifyInstance } from "fastify";
import * as C from "../controllers/other.controller";

export default async function otherRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["other-routes"],
      security: [{ bearerAuth: [] }],
    };
  });

  app.get(
    "/redis/reset",
    {
      schema: {
        summary: "Flush Redis Cache",
        description:
          "Flush all Redis cache or selectively clear a single cache group (servers, ads, etc.)",
        querystring: {
          type: "object",
          properties: {
            group: {
              type: "string",
              enum: [
                "servers",
                "ads",
                "cities",
                "countries",
                "connectivity",
                "dropdowns",
                "pages",
                "faq",
                "feedback",
                "dashboard",
                "meta",
              ],
              description:
                "Select which cache group to clear. If omitted, entire Redis cache will be flushed.",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              deletedCount: { type: "number" },
            },
          },
        },
      },
    },
    C.flushRedis
  );
}
