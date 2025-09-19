// src/controllers/dashboard.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import { FromGetDashboardQuery } from "../../../schemas/dashboard.schema";
import { getDashboardStats } from "../../../services/dashboard.service";

export async function getDashboard(
  req: FastifyRequest<{ Querystring: FromGetDashboardQuery }>,
  reply: FastifyReply
) {
  const { recent_limit = 5 } = req.query;
  const data = await getDashboardStats(recent_limit, {
    redis: req.server.redis,
  });
  return reply.send({ success: true, data });
}
