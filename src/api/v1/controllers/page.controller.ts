// src/controllers/page.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
    FromCreatePageBody,
    FromGetByTypeParams,
    FromListPagesQuery,
    FromParamsWithId,
    FromUpdatePageBody,
} from "../../../schemas/page.schema";
import * as S from "../../../services/page.service";

export async function list(
  req: FastifyRequest<{ Querystring: FromListPagesQuery }>,
  reply: FastifyReply
) {
  const { type, title, q, page = 1, limit = 50 } = req.query;
  const result = await S.listPages({ type, title, q }, page, limit, {
    redis: req.server.redis,
  });
  return reply.send(result);
}

export async function getById(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const item = await S.getPageById(req.params.id, { redis: req.server.redis });
  if (!item)
    return reply.code(404).send({ success: false, message: "Page not found" });
  return reply.send({ success: true, data: item });
}

export async function getByType(
  req: FastifyRequest<{ Params: FromGetByTypeParams }>,
  reply: FastifyReply
) {
  const item = await S.getPageByType(req.params.type, {
    redis: req.server.redis,
  });
  if (!item)
    return reply.code(404).send({ success: false, message: "Page not found" });
  return reply.send({ success: true, data: item });
}

export async function create(
  req: FastifyRequest<{ Body: FromCreatePageBody }>,
  reply: FastifyReply
) {
  const item = await S.createPage(req.body, { redis: req.server.redis });
  return reply.code(201).send({ success: true, data: item });
}

export async function update(
  req: FastifyRequest<{ Params: FromParamsWithId; Body: FromUpdatePageBody }>,
  reply: FastifyReply
) {
  const item = await S.updatePage(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!item)
    return reply.code(404).send({ success: false, message: "Page not found" });
  return reply.send({ success: true, data: item });
}

export async function remove(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const ok = await S.deletePage(req.params.id, { redis: req.server.redis });
  if (!ok)
    return reply.code(404).send({ success: false, message: "Page not found" });
  return reply.send({ success: true });
}
