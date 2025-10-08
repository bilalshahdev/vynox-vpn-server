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
    setHeaders(res, filePath, stat) {
      res.setHeader("Content-Type", "image/png"); 
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); 
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); 
      res.setHeader("Access-Control-Allow-Origin", "*"); 
    },
  });
});
