import fastifyStatic from "@fastify/static";
import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import path from "path";

export default fp(async function staticFlags(fastify: FastifyInstance) {
  const root = path.join(__dirname, "..", "..", "public", "flags");
  fastify.register(fastifyStatic, {
    root,
    prefix: "/api/v1/flags/",
    list: false,
  });
});
