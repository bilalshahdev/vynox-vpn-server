import fp from "fastify-plugin";
import env from "@fastify/env";
import { FastifyInstance } from "fastify";
import { Static, Type } from "@sinclair/typebox";

// define schema (runtime + TS type safety)
const envSchema = Type.Object({
  APP_ENV: Type.Union([
    Type.Literal("development"),
    Type.Literal("production"),
    Type.Literal("test"),
  ]),
  PORT: Type.Number({ default: 3000 }),
  MONGO_URI: Type.String(),
  REDIS_URL: Type.String(),
  JWT_SECRET: Type.String(),
});

type EnvConfig = Static<typeof envSchema>;

declare module "fastify" {
  interface FastifyInstance {
    config: EnvConfig;
  }
}

export default fp(async (app: FastifyInstance) => {
  await app.register(env, {
    dotenv: true, // loads from .env
    schema: envSchema,
  });
});
