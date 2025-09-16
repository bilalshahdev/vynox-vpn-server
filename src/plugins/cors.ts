// src/plugins/cors.ts
import cors from "@fastify/cors";
import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config";

export default fp(async function corsPlugin(app: FastifyInstance) {
  const isProd = config.app.env === "production";
  const rules = config.cors.origins;

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      const o = origin.toLowerCase().replace(/\/$/, "");

      if (!isProd && rules.length === 0) return cb(null, true);

      const allowed = rules.some((rule) =>
        rule instanceof RegExp ? rule.test(o) : rule === o
      );

      cb(null, allowed);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 600,
    strictPreflight: true,
  });

  app.log.info(
    { corsRules: rules.map((r) => (r instanceof RegExp ? r.toString() : r)) },
    "CORS configured"
  );
});
