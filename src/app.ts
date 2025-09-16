// src/app.ts
import Fastify, { FastifyInstance } from "fastify";
import fastifyMetrics from "fastify-metrics";
import usersRoutesV1 from "./api/v1/routes";
import corsPlugin from "./plugins/cors";
import dbPlugin from "./plugins/db";
import helmetPlugin from "./plugins/helmet";
import redisPlugin from "./plugins/redis";
import swaggerPlugin from "./plugins/swagger";
// import createLoggerConfig from "./utils/logger";

// src/app.ts
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === "production" ? "warn" : "debug" },
    trustProxy: true,
    keepAliveTimeout: 65_000,
    requestTimeout: 0,
    connectionTimeout: 0,
    ajv: { customOptions: { removeAdditional: true, coerceTypes: true } },
    disableRequestLogging: process.env.NODE_ENV === "production",
  });

  app.register(helmetPlugin, {
    /* keep minimal headers needed */
  });
  app.register(corsPlugin);

  if (process.env.NODE_ENV !== "production") {
    app.register(swaggerPlugin);
    app.register(fastifyMetrics, { endpoint: "/metrics" });
  }

  app.register(dbPlugin);
  app.register(redisPlugin);

  app.register(usersRoutesV1, { prefix: "/api/v1" });

  app.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              uptime: { type: "number" },
              time: { type: "string", format: "date-time" },
            },
            additionalProperties: false,
          },
        },
      },
    },
    async () => ({
      status: "ok",
      uptime: process.uptime(),
      time: new Date().toISOString(),
    })
  );

  // Avoid logging full error stack on hot paths in prod
  app.setErrorHandler((error, request, reply) => {
    if (process.env.NODE_ENV === "production")
      request.log.error({ msg: error.message });
    else request.log.error(error);
    reply
      .status(error.statusCode || 500)
      .send({ success: false, message: "Internal Server Error" });
  });

  return app;
}
