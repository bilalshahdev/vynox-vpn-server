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
        code: (error as any).code,
        reqId: (request as any).id,
      });
    } else {
      request.log.error(error);
    }

    // ----------- AJV validation (Fastify) -----------
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        message: "Validation error",
        context: error.validationContext, // 'params' | 'body' | 'querystring' | ...
        errors: error.validation, // ajv details
      });
    }

    // ----------- Mongoose / Mongo mappings -----------
    // Bad ObjectId (e.g., /:id malformed)
    if (error.name === "CastError" && error.path === "_id") {
      return reply.status(400).send({
        success: false,
        message: "Invalid id: must be a 24-hex Mongo ObjectId",
      });
    }

    // Duplicate key
    if (error.code === 11000) {
      return reply.status(409).send({
        success: false,
        message: "Duplicate key",
        // keyValue is helpful in dev; keep or strip in prod
        key: error.keyValue,
      });
    }

    // ----------- Fallback -----------
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    const message =
      status >= 500 ? "Internal Server Error" : error.message || "Error";

    return reply.status(status).send({ success: false, message });
  });
});
