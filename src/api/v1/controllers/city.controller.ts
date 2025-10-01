// src/controllers/city.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromCityIdParams,
  FromCreateCityBody,
  FromListCitiesQuery,
  FromSearchCitiesQuery,
  FromUpdateCityBody,
} from "../../../schemas/city.schema";
import * as S from "../../../services/city.service";

// ---------- Get City by ID ----------
export async function getById(
  req: FastifyRequest<{ Params: FromCityIdParams }>,
  reply: FastifyReply
) {
  const city = await S.getCityById(req.params.id);
  if (!city)
    return reply.code(404).send({ success: false, message: "City not found" });

  return reply.send(city);
}

// ---------- List Cities (paginated) ----------
export async function list(
  req: FastifyRequest<{ Querystring: FromListCitiesQuery }>,
  reply: FastifyReply
) {
  const { country, state, page = 1, limit = 50 } = req.query;
  const result = await S.listCities({ country, state }, page, limit, {
    redis: req.server.redis,
  });
  return reply.send(result);
}

// ---------- Search Cities ----------
export async function search(
  req: FastifyRequest<{ Querystring: FromSearchCitiesQuery }>,
  reply: FastifyReply
) {
  const { q, country, state, limit = 20 } = req.query;
  const result = await S.searchCities({ q, country, state }, limit, {
    redis: req.server.redis,
  });
  return reply.send(result);
}

// ---------- Create City ----------
export async function create(
  req: FastifyRequest<{ Body: FromCreateCityBody }>,
  reply: FastifyReply
) {
  const data = await S.createCity(req.body, { redis: req.server.redis });
  return reply.code(201).send({ success: true, data });
}

// ---------- Update City ----------
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

// ---------- Delete City ----------
export async function remove(
  req: FastifyRequest<{ Params: FromCityIdParams }>,
  reply: FastifyReply
) {
  const ok = await S.deleteCity(req.params.id, { redis: req.server.redis });
  if (!ok)
    return reply.code(404).send({ success: false, message: "City not found" });

  return reply.send({ success: true });
}
