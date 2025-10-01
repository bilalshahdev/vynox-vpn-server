// src/plugins/error-handler.ts
import type { FastifyError, FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export default fp(async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError & any, request, reply) => {
    const isProd = process.env.NODE_ENV === "production";

    // ----------- Logging -----------
    if (isProd) {
      request.log.error({
        msg: error.message,
        name: error.name,
        code: error.code,
        reqId: (request as any).id,
      });
    } else {
      request.log.error(error);
    }

    if (Array.isArray(error.validation)) {
      // Request schema error
      return reply.status(400).send({
        success: false,
        message: "Request validation error",
        context: error.validationContext || "unknown",
        errors: error.validation,
      });
    }

    if (error.code === "FST_ERR_RESPONSE_SERIALIZATION") {
      // Response schema error
      return reply.status(500).send({
        success: false,
        message: "Response serialization error",
        details: error.message,
      });
    }

    // ----------- Mongoose errors -----------
    if (error.name === "CastError" && error.path === "_id") {
      return reply.status(400).send({
        success: false,
        message: "Invalid id: must be a 24-hex Mongo ObjectId",
      });
    }

    if (error.code === 11000) {
      return reply.status(409).send({
        success: false,
        message: "Duplicate key",
        key: error.keyValue,
      });
    }

    // ----------- Fallback -----------
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    const message = error.message || "Internal Server Error";

    return reply.status(status).send({ success: false, message });
  });
});
