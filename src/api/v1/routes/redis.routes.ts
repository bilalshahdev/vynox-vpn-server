import { FastifyInstance } from "fastify";
import { verifyToken } from "../../../utils/tokens";

export default async function redisRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["redis"],
      security: [{ bearerAuth: [] }],
    };
  });
  app.post(
    "/reset",
    // { schema: {}, preHandler: verifyToken },
    async (req, reply) => {
      try {
        // ⚠️ Danger: flushes all keys in the current DB
        await app.redis.flushall();

        return { success: true, message: "Redis cache cleared successfully." };
      } catch (err) {
        app.log.error(err);
        return reply.status(500).send({
          success: false,
          message: "Failed to clear Redis cache",
        });
      }
    }
  );
}
