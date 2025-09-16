import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import Redis from "ioredis";
import { config } from "../config";

export default fp(async (app: FastifyInstance) => {
  const redis = new Redis(config.redis.url);

  redis.on("connect", () => {
    console.log("✅ Connected to Redis");
  });

  redis.on("error", (err) => {
    console.error("❌ Redis connection error:", err.message);
  });

  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    await redis.quit();
    console.log("🛑 Redis disconnected");
  });
});

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}
