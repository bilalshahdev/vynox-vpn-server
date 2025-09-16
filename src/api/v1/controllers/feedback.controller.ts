// src/controllers/feedback.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromListFeedbackQuery,
  FromParamsWithId,
  FromCreateFeedbackBody,
} from "../../../schemas/feedback.schema";
import * as S from "../../../services/feedback.service";

export async function list(
  req: FastifyRequest<{ Querystring: FromListFeedbackQuery }>,
  reply: FastifyReply
) {
  const {
    server_id,
    reason,
    network_type,
    rating_min,
    rating_max,
    from,
    to,
    page = 1,
    limit = 50,
  } = req.query;
  const result = await S.listFeedback(
    { server_id, reason, network_type, rating_min, rating_max, from, to },
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
  const item = await S.getFeedbackById(req.params.id, {
    redis: req.server.redis,
  });
  if (!item)
    return reply
      .code(404)
      .send({ success: false, message: "Feedback not found" });
  return reply.send({ success: true, data: item });
}

export async function create(
  req: FastifyRequest<{ Body: FromCreateFeedbackBody }>,
  reply: FastifyReply
) {
  const item = await S.createFeedback(req.body, { redis: req.server.redis });
  return reply.code(201).send({ success: true, data: item });
}

export async function remove(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const ok = await S.deleteFeedback(req.params.id, { redis: req.server.redis });
  if (!ok)
    return reply
      .code(404)
      .send({ success: false, message: "Feedback not found" });
  return reply.send({ success: true });
}
