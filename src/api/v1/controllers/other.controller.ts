import { FastifyReply, FastifyRequest } from "fastify";

const BATCH = 500;

// Define logical groups and patterns
const GROUP_PATTERNS: Record<string, string[]> = {
  servers: ["*server*", "*servers*"],
  ads: ["*ad*", "*ads*"],
  cities: ["*city*", "*cities*"],
  countries: ["*country*", "*countries*"],
  connectivity: ["*connectivity*", "*openByPair*"],
  dropdowns: ["*dropdown*"],
  pages: ["*page*"],
  faq: ["*faq*"],
  feedback: ["*feedback*"],
  dashboard: ["v1:dashboard:stats:*"],
  meta: ["*collection-version*", "*ver:*", "*meta:*"],
};

// Utility: delete keys matching patterns
async function deleteByPatterns(redis: any, patterns: string[]) {
  let total = 0;
  for (const pattern of patterns) {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        BATCH
      );
      cursor = next;
      if (keys.length) {
        total += keys.length;
        await redis.unlink(...keys); // Non-blocking delete
      }
    } while (cursor !== "0");
  }
  return total;
}

// Controller: flush Redis cache (all or by group)
export async function flushRedis(req: FastifyRequest, reply: FastifyReply) {
  const redis = req.server.redis;
  const group = (req.query as any).group as string | undefined;

  try {
    let deletedCount = 0;
    let message = "";

    if (group && GROUP_PATTERNS[group]) {
      deletedCount = await deleteByPatterns(redis, GROUP_PATTERNS[group]);
      message = `Cleared ${deletedCount} keys for group '${group}'.`;
    } else if (group && !GROUP_PATTERNS[group]) {
      return reply.status(400).send({
        success: false,
        message: `Unknown group '${group}'. Available groups: ${Object.keys(
          GROUP_PATTERNS
        ).join(", ")}.`,
      });
    } else {
      await redis.flushall(); // fallback full flush
      message = "Redis cache fully cleared (flushall).";
    }

    req.log.info({
      action: "redis_flush",
      group: group || "all",
      deletedCount,
    });
    return { success: true, message, deletedCount };
  } catch (err) {
    req.log.error(err);
    return reply.status(500).send({
      success: false,
      message: "Failed to clear Redis cache",
    });
  }
}
