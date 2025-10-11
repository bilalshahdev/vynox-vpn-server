import { FastifyReply, FastifyRequest } from "fastify";
import { sendServerDownEmail } from "../../../utils/sendServerDownEmail";
import { ServerModel } from "../../../models/server.model";

export async function ServerDown(
  req: FastifyRequest<{ Params: { ip: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { ip } = req.params;

    const exists = await ServerModel.findOne({ "general.ip": ip });
    if (!exists) {
      return reply
        .status(404)
        .send({ message: `No server found for IP: ${ip}` });
    }

    await sendServerDownEmail(ip);

    return reply
      .status(200)
      .send({ message: `Alert sent for server down at IP: ${ip}` });
  } catch (error) {
    console.error("ServerDown Error:", error);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

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
