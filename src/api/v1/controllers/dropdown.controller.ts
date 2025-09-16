// src/controllers/dropdown.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromListDropdownsQuery,
  FromParamsWithId,
  FromGetByNameParams,
  FromCreateDropdownBody,
  FromUpdateDropdownBody,
  FromAddDropdownValueBody,
  FromUpdateDropdownValueBody,
  FromRemoveDropdownValueBody,
} from "../../../schemas/dropdown.schema";
import * as dS from "../../../services/dropdown.service";

export async function list(
  req: FastifyRequest<{ Querystring: FromListDropdownsQuery }>,
  reply: FastifyReply
) {
  const { name, page = 1, limit = 50 } = req.query;
  const result = await dS.listDropdowns({ name }, page, limit, {
    redis: req.server.redis,
  });
  return reply.send(result);
}

export async function getById(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const item = await dS.getDropdownById(req.params.id, {
    redis: req.server.redis,
  });
  if (!item)
    return reply
      .code(404)
      .send({ success: false, message: "Dropdown not found" });
  return reply.send({ success: true, data: item });
}

export async function getByName(
  req: FastifyRequest<{ Params: FromGetByNameParams }>,
  reply: FastifyReply
) {
  const item = await dS.getDropdownByName(req.params.name, {
    redis: req.server.redis,
  });
  if (!item)
    return reply
      .code(404)
      .send({ success: false, message: "Dropdown not found" });
  return reply.send({ success: true, data: item });
}

export async function create(
  req: FastifyRequest<{ Body: FromCreateDropdownBody }>,
  reply: FastifyReply
) {
  const item = await dS.createDropdown(req.body, { redis: req.server.redis });
  return reply.code(201).send({ success: true, data: item });
}

export async function update(
  req: FastifyRequest<{
    Params: FromParamsWithId;
    Body: FromUpdateDropdownBody;
  }>,
  reply: FastifyReply
) {
  const item = await dS.updateDropdown(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!item)
    return reply
      .code(404)
      .send({ success: false, message: "Dropdown not found" });
  return reply.send({ success: true, data: item });
}

export async function addValue(
  req: FastifyRequest<{
    Params: FromParamsWithId;
    Body: FromAddDropdownValueBody;
  }>,
  reply: FastifyReply
) {
  const item = await dS.addDropdownValue(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!item)
    return reply
      .code(404)
      .send({ success: false, message: "Dropdown not found" });
  return reply.send({ success: true, data: item });
}

export async function updateValue(
  req: FastifyRequest<{
    Params: FromParamsWithId;
    Body: FromUpdateDropdownValueBody;
  }>,
  reply: FastifyReply
) {
  const item = await dS.updateDropdownValue(
    req.params.id,
    req.body.old_value,
    { new_name: req.body.new_name, new_value: req.body.new_value },
    { redis: req.server.redis }
  );
  if (!item)
    return reply
      .code(404)
      .send({
        success: false,
        message: "Dropdown not found or value not present",
      });
  return reply.send({ success: true, data: item });
}

export async function removeValue(
  req: FastifyRequest<{
    Params: FromParamsWithId;
    Body: FromRemoveDropdownValueBody;
  }>,
  reply: FastifyReply
) {
  const item = await dS.removeDropdownValue(req.params.id, req.body.value, {
    redis: req.server.redis,
  });
  if (!item)
    return reply
      .code(404)
      .send({
        success: false,
        message: "Dropdown not found or value not present",
      });
  return reply.send({ success: true, data: item });
}

export async function remove(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const ok = await dS.deleteDropdown(req.params.id, {
    redis: req.server.redis,
  });
  if (!ok)
    return reply
      .code(404)
      .send({ success: false, message: "Dropdown not found" });
  return reply.send({ success: true });
}
