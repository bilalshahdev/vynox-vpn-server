import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import { FastifyInstance } from "fastify";
import { config } from "../config";

export default fp(async function helmetPlugin(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy:
      config.app.env === "production"
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
              styleSrc: ["'self'", "fonts.googleapis.com", "'unsafe-inline'"],
              fontSrc: ["'self'", "fonts.gstatic.com"],
              imgSrc: ["'self'", "data:"],
            },
          }
        : false,
    crossOriginEmbedderPolicy: false,
  });

  app.log.info("Helmet security headers enabled");
});
