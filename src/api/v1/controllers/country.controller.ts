// src/controllers/country.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromCountryIdParams,
  FromCreateCountryBody,
  FromListCountriesQuery,
  FromSearchCountriesQuery,
  FromUpdateCountryBody,
} from "../../../schemas/country.schema";
import * as S from "../../../services/country.service";

export async function list(
  req: FastifyRequest<{ Querystring: FromListCountriesQuery }>,
  reply: FastifyReply
) {
  const { page = 1, limit = 50 } = req.query;
  const result = await S.listCountries(page, limit, {
    redis: req.server.redis,
  });
  return reply.send(result);
}

export async function search(
  req: FastifyRequest<{ Querystring: FromSearchCountriesQuery }>,
  reply: FastifyReply
) {
  const { q, limit = 20 } = req.query;
  const result = await S.searchCountries(q, limit, { redis: req.server.redis });
  return reply.send(result);
}

export async function create(
  req: FastifyRequest<{ Body: FromCreateCountryBody }>,
  reply: FastifyReply
) {
  const data = await S.createCountry(req.body, { redis: req.server.redis });
  return reply.code(201).send({ success: true, data });
}

export async function update(
  req: FastifyRequest<{
    Params: FromCountryIdParams;
    Body: FromUpdateCountryBody;
  }>,
  reply: FastifyReply
) {
  const data = await S.updateCountry(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!data)
    return reply
      .code(404)
      .send({ success: false, message: "Country not found" });
  return reply.send({ success: true, data });
}

export async function remove(
  req: FastifyRequest<{ Params: FromCountryIdParams }>,
  reply: FastifyReply
) {
  const ok = await S.deleteCountry(req.params.id, { redis: req.server.redis });
  if (!ok)
    return reply
      .code(404)
      .send({ success: false, message: "Country not found" });
  return reply.send({ success: true });
}
