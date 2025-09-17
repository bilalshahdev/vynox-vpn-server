import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { FastifyInstance } from "fastify";

export default fp(async function jwtPlugin(app: FastifyInstance) {
  app.register(jwt, {
    secret: process.env.JWT_SECRET || "supersecret",
  });

  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
});
