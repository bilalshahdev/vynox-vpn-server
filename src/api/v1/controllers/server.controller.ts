// src/controllers/server.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  FromListServersQuery,
  FromCreateServerBody,
  FromUpdateServerBody,
  FromParamsWithId,
  FromUpdateModeBody,
  FromUpdateIsProBody,
  FromUpdateOpenVPNConfigBody,
  FromUpdateWireguardConfigBody,
  FromCreateMultipleServersBody,
} from "../../../schemas/server.schema";
import * as S from "../../../services/server.service";
import { ServerModel } from "../../../models/server.model";
import { sendServerDownEmail } from "../../../utils/sendServerDownEmail";

export async function listServers(
  req: FastifyRequest<{ Querystring: FromListServersQuery }>,
  reply: FastifyReply
) {
  const { os_type, mode, search, page = 1, limit = 50 } = req.query;
  const result = await S.listServers({ os_type, mode, search }, page, limit, {
    redis: req.server.redis,
  });
  return reply.send(result);
}

export async function listGroupedServers(
  req: FastifyRequest<{ Querystring: FromListServersQuery }>,
  reply: FastifyReply
) {
  const { os_type, mode, search, page = 1, limit = 50 } = req.query;
  const result = await S.listGroupedServers(
    { os_type, mode, search },
    page,
    limit,
    {
      redis: req.server.redis,
    }
  );
  return reply.send(result);
}

export async function getById(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const server = await S.getServerById(req.params.id, {
    redis: req.server.redis,
  });

  if (!server)
    return reply
      .code(404)
      .send({ success: false, message: "Server not found" });
  return reply.send({ success: true, data: server });
}

export async function create(
  req: FastifyRequest<{ Body: FromCreateServerBody }>,
  reply: FastifyReply
) {
  const server = await S.createServer(req.body as any, {
    redis: req.server.redis,
  });
  return reply.code(201).send({ success: true, data: server });
}

export async function createMultiple(
  req: FastifyRequest<{ Body: FromCreateMultipleServersBody }>,
  reply: FastifyReply
) {
  const serversData = req.body;

  const results = [];
  for (const payload of serversData) {
    try {
      const server = await S.createServer(payload as any, {
        redis: req.server.redis,
      });
      results.push(server);
    } catch (err: any) {
      // you could skip, or push error info
      results.push({
        error: err.message,
        ip: payload.general?.ip,
        os_type: payload.general?.os_type,
      });
    }
  }

  return reply.code(201).send({ success: true, data: results });
}

export async function update(
  req: FastifyRequest<{ Params: FromParamsWithId; Body: FromUpdateServerBody }>,
  reply: FastifyReply
) {
  const server = await S.updateServer(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!server)
    return reply
      .code(404)
      .send({ success: false, message: "Server not found" });
  return reply.send({ success: true, data: server });
}

export async function updateMode(
  req: FastifyRequest<{ Params: FromParamsWithId; Body: FromUpdateModeBody }>,
  reply: FastifyReply
) {
  const server = await S.setServerMode(req.params.id, req.body.mode, {
    redis: req.server.redis,
  });
  if (!server)
    return reply
      .code(404)
      .send({ success: false, message: "Server not found" });
  return reply.send({ success: true, data: server });
}

export async function updateIsPro(
  req: FastifyRequest<{ Params: FromParamsWithId; Body: FromUpdateIsProBody }>,
  reply: FastifyReply
) {
  const server = await S.setServerIsPro(req.params.id, req.body.is_pro, {
    redis: req.server.redis,
  });
  if (!server)
    return reply
      .code(404)
      .send({ success: false, message: "Server not found" });
  return reply.send({ success: true, data: server });
}

export async function updateOpenVPNConfig(
  req: FastifyRequest<{
    Params: FromParamsWithId;
    Body: FromUpdateOpenVPNConfigBody;
  }>,
  reply: FastifyReply
) {
  const server = await S.updateOpenVPNConfig(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!server)
    return reply
      .code(404)
      .send({ success: false, message: "Server not found" });
  return reply.send({ success: true, data: server });
}

export async function updateWireguardConfig(
  req: FastifyRequest<{
    Params: FromParamsWithId;
    Body: FromUpdateWireguardConfigBody;
  }>,
  reply: FastifyReply
) {
  const server = await S.updateWireguardConfig(req.params.id, req.body, {
    redis: req.server.redis,
  });
  if (!server)
    return reply
      .code(404)
      .send({ success: false, message: "Server not found" });
  return reply.send({ success: true, data: server });
}

export async function remove(
  req: FastifyRequest<{ Params: FromParamsWithId }>,
  reply: FastifyReply
) {
  const ok = await S.deleteServer(req.params.id, { redis: req.server.redis });
  if (!ok)
    return reply
      .code(404)
      .send({ success: false, message: "Server not found" });
  return reply.send({ success: true });
}

export async function ServerDown(
  req: FastifyRequest<{ Params: { ip: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { ip } = req.params;

    const exists = await ServerModel.findOne({ "general.ip": ip });
    if (!exists) {
      return reply
        .status(404)
        .send({ message: `No server found for IP: ${ip}` });
    }

    await sendServerDownEmail(ip);

    return reply
      .status(200)
      .send({ message: `Alert sent for server down at IP: ${ip}` });
  } catch (error) {
    console.error("ServerDown Error:", error);
    const err = error as Error;
    return reply
      .status(500)
      .send({ error: err.message || "Internal Server Error" });
  }
}
