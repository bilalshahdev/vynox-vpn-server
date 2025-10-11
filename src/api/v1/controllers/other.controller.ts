import { FastifyReply, FastifyRequest } from "fastify";

// flush redis
export async function flushRedis(req: FastifyRequest, reply: FastifyReply) {
  try {
    // ⚠️ Danger: flushes all keys in the current DB
    await req.server.redis.flushall();

    return { success: true, message: "Redis cache cleared successfully." };
  } catch (err) {
    req.log.error(err);
    return reply.status(500).send({
      success: false,
      message: "Failed to clear Redis cache",
    });
  }
}
