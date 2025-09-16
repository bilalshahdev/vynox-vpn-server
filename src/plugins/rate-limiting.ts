// import fp from "fastify-plugin";
// import rateLimit from "@fastify/rate-limit";
// import type { FastifyInstance } from "fastify";
// import IORedis from "ioredis";
// import { config } from "../config";

// function parseList(v?: string) {
//   return (v ?? "")
//     .split(",")
//     .map(s => s.trim())
//     .filter(Boolean);
// }

// export default fp(async function rateLimitPlugin(app: FastifyInstance) {
//   if (!env.RATE_LIMIT_ENABLED) {
//     app.log.info("Rate limiting disabled");
//     return;
//   }

//   // If you're behind a reverse proxy / load balancer, make sure to trust proxy
//   // so Fastify uses X-Forwarded-For for client IP.
//   // You can also set this in your app factory.
//   app.setTrustProxy(true);

//   // Optional: shared store for multiple instances
//   let redis: IORedis.Redis | undefined;
//   if (env.USE_REDIS_RATE_LIMIT) {
//     redis = new IORedis(env.REDIS_URL);
//     redis.on("error", (err) => app.log.error({ err }, "Redis rate-limit error"));
//   }

//   const allowlist = new Set(parseList(env.RATE_LIMIT_ALLOWLIST));

//   await app.register(rateLimit, {
//     max: env.RATE_LIMIT_MAX ?? 1000,          // default limit
//     timeWindow: env.RATE_LIMIT_WINDOW ?? "1 minute",
//     cache: 10000,                              // in-memory cache size (keys)
//     ban: 0,                                    // optional auto-ban threshold
//     allowList: (req, key) => {
//       // Allowlist exact IPs or internal health checks
//       if (allowlist.has(key)) return true;
//       // Example: allow private load balancer or your internal CIDR:
//       // if (key.startsWith("10.") || key.startsWith("192.168.")) return true;
//       return false;
//     },
//     keyGenerator: (req) => {
//       // Prefer authenticated user ID if present; fall back to IP.
//       // You can set req.user in an auth plugin/decorator.
//       //@ts-ignore
//       const userId = req.user?.id as string | undefined;
//       if (userId) return `user:${userId}`;
//       // app is behind proxy, so Fastify already resolves client IP
//       return req.ip;
//     },
//     // When your store (Redis) is down, don't DOS your users due to plugin errors
//     skipOnError: true,
//     // Expose standard headers (X-RateLimit-*)
//     addHeaders: {
//       "x-ratelimit-limit": true,
//       "x-ratelimit-remaining": true,
//       "x-ratelimit-reset": true,
//       "retry-after": true,
//     },
//     // Shared store across instances if provided
//     redis, // omit to use in-memory
//     // enable Draft 7 headers name style (optional)
//     // enableDraftSpec: true,
//   });

//   app.log.info("Rate limiting configured");
// });
