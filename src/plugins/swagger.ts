// src/plugins/swagger.ts
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config";

export default fp(async function swaggerPlugin(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "vynox-vpn-server API",
        version: config.app.version,
      },
      servers: [{ url: "/api/v1", description: "v1" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [{ name: "health", description: "Service health checks" }],
    },
    refResolver: { buildLocalReference: (json, base, frag, i) => `def-${i}` },
  });

  if (config.swagger.enabled && config.app.env !== "production") {
    await app.register(swaggerUI, {
      routePrefix: "/docs",
      uiConfig: {
        deepLinking: true,
        defaultModelsExpandDepth: -1,
        docExpansion: "list",
      },
      staticCSP: true,
      transformSpecificationClone: true,
    });
  }

  app.log.info(
    `Swagger UI ${
      config.swagger.enabled && config.app.env !== "production"
        ? "enabled at /docs"
        : "disabled"
    }`
  );
});
