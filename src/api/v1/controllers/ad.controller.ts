// src/controllers/ad.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromCreateAdBody,
  FromListAdsQuery,
  FromParamsWithId,
  FromUpdateAdBody,
  FromUpdateAdStatusBody,
} from "../../../schemas/ad.schema";
import * as S from "../../../services/ad.service";

export async function listAds(
  req: FastifyRequest<{ Querystring: FromListAdsQuery }>,
  reply: FastifyReply
) {
  const { os_type, type, position, status, page = 1, limit = 50 } = req.query;
  const result = await S.listAds(
    { os_type, type, position, status },
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
  const ad = await S.getAdById(req.params.id, { redis: req.server.redis });
  if (!ad)
    return reply.code(404).send({ success: false, message: "Ad not found" });
  return reply.send({ success: true, data: ad });
}

export async function create(
  req: FastifyRequest<{ Body: FromCreateAdBody }>,
  reply: FastifyReply
) {
  const ad = await S.createAd(req.body, { redis: req.server.redis });
  return reply.code(201).send({ success: true, data: ad });
}

export async function update(
  req: FastifyRequest<{ Params: FromParamsWithId; Body: FromUpdateAdBody }>,
  reply: FastifyReply
) {
  const ad = await S.updateAd(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!ad)
    return reply.code(404).send({ success: false, message: "Ad not found" });
  return reply.send({ success: true, data: ad });
}

export async function updateStatus(
  req: FastifyRequest<{
    Params: FromParamsWithId;
    Body: FromUpdateAdStatusBody;
  }>,
  reply: FastifyReply
) {
  const ad = await S.setAdStatus(req.params.id, req.body.status, {
    redis: req.server.redis,
  });
  if (!ad)
    return reply.code(404).send({ success: false, message: "Ad not found" });
  return reply.send({ success: true, data: ad });
}

export async function remove(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const ok = await S.deleteAd(req.params.id, { redis: req.server.redis });
  if (!ok)
    return reply.code(404).send({ success: false, message: "Ad not found" });
  return reply.send({ success: true });
}
