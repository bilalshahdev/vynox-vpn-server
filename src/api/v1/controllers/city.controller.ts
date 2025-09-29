// src/controllers/city.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromCreateCityBody,
  FromUpdateCityBody,
  FromCityIdParams,
  FromListCitiesQuery,
  FromSearchCitiesQuery,
} from "../../../schemas/city.schema";
import * as S from "../../../services/city.service";

export async function list(
  req: FastifyRequest<{ Querystring: FromListCitiesQuery }>,
  reply: FastifyReply
) {
  const { country_id, state, page = 1, limit = 50 } = req.query;
  const result = await S.listCities({ country_id, state }, page, limit, {
    redis: req.server.redis,
  });
  return reply.send(result);
}

export async function search(
  req: FastifyRequest<{ Querystring: FromSearchCitiesQuery }>,
  reply: FastifyReply
) {
  const { q, country_id, state, limit = 20 } = req.query;
  const result = await S.searchCities({ q, country_id, state }, limit, {
    redis: req.server.redis,
  });
  return reply.send(result);
}

export async function create(
  req: FastifyRequest<{ Body: FromCreateCityBody }>,
  reply: FastifyReply
) {
  const data = await S.createCity(req.body, { redis: req.server.redis });
  return reply.code(201).send({ success: true, data });
}

export async function update(
  req: FastifyRequest<{ Params: FromCityIdParams; Body: FromUpdateCityBody }>,
  reply: FastifyReply
) {
  const data = await S.updateCity(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!data)
    return reply.code(404).send({ success: false, message: "City not found" });
  return reply.send({ success: true, data });
}

export async function remove(
  req: FastifyRequest<{ Params: FromCityIdParams }>,
  reply: FastifyReply
) {
  const ok = await S.deleteCity(req.params.id, { redis: req.server.redis });
  if (!ok)
    return reply.code(404).send({ success: false, message: "City not found" });
  return reply.send({ success: true });
}
