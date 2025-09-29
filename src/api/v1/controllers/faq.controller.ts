// src/controllers/faq.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromCreateFaqBody,
  FromListFaqsQuery,
  FromParamsWithId,
  FromSearchFaqsQuery,
  FromUpdateFaqBody,
} from "../../../schemas/faq.schema";
import * as S from "../../../services/faq.service";

export async function list(
  req: FastifyRequest<{ Querystring: FromListFaqsQuery }>,
  reply: FastifyReply
) {
  const { page = 1, limit = 50 } = req.query;
  const result = await S.listFaqs(page, limit, { redis: req.server.redis });
  return reply.send(result);
}

export async function search(
  req: FastifyRequest<{ Querystring: FromSearchFaqsQuery }>,
  reply: FastifyReply
) {
  const { q, limit = 20 } = req.query;
  const result = await S.searchFaqs(q, limit, { redis: req.server.redis });
  return reply.send(result);
}

export async function getById(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const item = await S.getFaqById(req.params.id, { redis: req.server.redis });
  if (!item)
    return reply.code(404).send({ success: false, message: "FAQ not found" });
  return reply.send({ success: true, data: item });
}

export async function create(
  req: FastifyRequest<{ Body: FromCreateFaqBody }>,
  reply: FastifyReply
) {
  const data = await S.createFaq(req.body, { redis: req.server.redis });
  return reply.code(201).send({ success: true, data });
}

export async function update(
  req: FastifyRequest<{ Params: FromParamsWithId; Body: FromUpdateFaqBody }>,
  reply: FastifyReply
) {
  const data = await S.updateFaq(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!data)
    return reply.code(404).send({ success: false, message: "FAQ not found" });
  return reply.send({ success: true, data });
}

export async function remove(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const ok = await S.deleteFaq(req.params.id, { redis: req.server.redis });
  if (!ok)
    return reply.code(404).send({ success: false, message: "FAQ not found" });
  return reply.send({ success: true });
}
