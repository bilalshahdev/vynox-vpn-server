// /controllers/connectivity.controller.ts

import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromConnectBody,
  FromDisconnectBody,
  FromListConnectivityQuery,
  FromOpenByPairQuery,
  FromParamsWithId,
  FromServersWithStatsQuery,
} from "../../../schemas/connectivity.schema";
import * as S from "../../../services/connectivity.service";

export async function serverListWithStats(
  req: FastifyRequest<{ Querystring: FromServersWithStatsQuery }>,
  reply: FastifyReply
) {
  const { page = 1, limit = 50, os_type, search } = req.query;

  const result = await S.getServersWithConnectionStats(
    page,
    limit,
    { redis: req.server.redis },
    { os_type, search } 
  );

  return reply.send(result);
}

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

export async function getOpenByPair(
  req: FastifyRequest<{ Querystring: FromOpenByPairQuery }>,
  reply: FastifyReply
) {
  const { user_id, server_id } = req.query;
  const item = await S.getOpenByPair(
    { user_id, server_id },
    { redis: req.server.redis }
  );
  return reply.send({ success: true, data: item });
}

export async function connect(
  req: FastifyRequest<{ Body: FromConnectBody }>,
  reply: FastifyReply
) {
  const { user_id, server_id } = req.body;

  const result = await S.connect(
    { user_id, server_id },
    { redis: req.server.redis }
  );

  if (result.status === "conflict") {
    return reply.code(409).send({
      success: false,
      message:
        "Already connected: an open session exists for this user and server.",
    });
  }

  return reply.code(201).send({ success: true, data: result.data });
}

export async function disconnect(
  req: FastifyRequest<{ Body: FromDisconnectBody }>,
  reply: FastifyReply
) {
  const { user_id, server_id } = req.body;

  const item = await S.disconnect(
    { user_id, server_id },
    { redis: req.server.redis }
  );

  if (!item) {
    return reply.code(409).send({
      success: false,
      message:
        "Cannot disconnect: no open session exists for this user and server.",
    });
  }

  return reply.send({ success: true, data: item });
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
