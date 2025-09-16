// src/controllers/connectivity.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromListConnectivityQuery,
  FromParamsWithId,
  FromCreateConnectivityBody,
} from "../../../schemas/connectivity.schema";
import * as S from "../../../services/connectivity.service";

export async function list(
  req: FastifyRequest<{ Querystring: FromListConnectivityQuery }>,
  reply: FastifyReply
) {
  const { user_id, server_id, from, to, page = 1, limit = 50 } = req.query;
  const result = await S.listConnectivity(
    { user_id, server_id, from, to },
    page,
    limit,
    { redis: req.server.redis }
  );
  return reply.send(result);
}

export async function getById(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const item = await S.getConnectivityById(req.params.id, {
    redis: req.server.redis,
  });
  if (!item)
    return reply
      .code(404)
      .send({ success: false, message: "Connectivity not found" });
  return reply.send({ success: true, data: item });
}

export async function create(
  req: FastifyRequest<{ Body: FromCreateConnectivityBody }>,
  reply: FastifyReply
) {
  const item = await S.createConnectivity(req.body, {
    redis: req.server.redis,
  });
  return reply.code(201).send({ success: true, data: item });
}

// PATCH /connectivity/:id/disconnected-at -> sets NOW (no body)
export async function updateDisconnectedAt(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const item = await S.markDisconnectedNow(req.params.id, {
    redis: req.server.redis,
  });
  if (item) return reply.send({ success: true, data: item });

  const exists = await S.getConnectivityById(req.params.id, {
    redis: req.server.redis,
  });
  if (!exists)
    return reply
      .code(404)
      .send({ success: false, message: "Connectivity not found" });

  return reply.code(409).send({
    success: false,
    message:
      "Cannot set disconnected_at: already set or connected_at is in the future.",
  });
}

export async function remove(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const ok = await S.deleteConnectivity(req.params.id, {
    redis: req.server.redis,
  });
  if (!ok)
    return reply
      .code(404)
      .send({ success: false, message: "Connectivity not found" });
  return reply.send({ success: true });
}
