// src/controllers/server.controller.ts
import http from "http";
import { FastifyReply, FastifyRequest } from "fastify";
import * as SCH from "../../../schemas/server.schema";
import * as S from "../../../services/server.service";
import { ServerModel } from "../../../models/server.model";
import { sendServerDownEmail } from "../../../utils/sendServerDownEmail";
import { serverStatsPort } from "../../../config/constants";
import { config } from "../../../config";

export async function listServers(
  req: FastifyRequest<{ Querystring: SCH.FromListServersQuery }>,
  reply: FastifyReply
) {
  const { os_type, mode, search, page = 1, limit = 50 } = req.query;
  const result = await S.listServers({ os_type, mode, search }, page, limit, {
    redis: req.server.redis,
  });
  return reply.send(result);
}

export async function listGroupedServers(
  req: FastifyRequest<{ Querystring: SCH.FromListServersQuery }>,
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
  req: FastifyRequest<{ Params: SCH.FromParamsWithId }>,
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

export async function streamServerStatus(
  req: FastifyRequest<{ Params: { ip: string } }>,
  reply: FastifyReply
) {
  const { ip } = req.params;

  if (!ip) {
    return reply
      .code(400)
      .send({ success: false, message: "Missing server IP" });
  }

  if (!serverStatsPort) {
    return reply
      .code(500)
      .send({ success: false, message: "Server stats port not configured" });
  }

  const url = `http://${ip}:${serverStatsPort}/status`;

  const origin = req.headers.origin;
  const isAllowed = config.cors.origins.some((rule) =>
    rule instanceof RegExp ? rule.test(origin || "") : rule === origin
  );

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": isAllowed ? origin || "*" : "null",
    "Access-Control-Allow-Credentials": "true",
  });

  const request = http.get(url, (res) => {
    if (res.statusCode !== 200) {
      reply.raw.write(
        `event: error\ndata: ${JSON.stringify({
          error: `Failed to fetch status from ${ip}. Server responded with ${res.statusCode} ${res.statusMessage}`,
        })}\n\n`
      );
      reply.raw.end();
      request.destroy();
      return;
    }

    res.on("data", (chunk) => {
      try {
        reply.raw.write(chunk);
      } catch (err) {
        console.error("Error writing SSE chunk:", err);
      }
    });

    res.on("end", () => {
      reply.raw.end();
    });
  });

  request.on("error", (err: any) => {
    console.error("Error connecting to status server:", err.message);
    reply.raw.write(
      `event: error\ndata: ${JSON.stringify({
        error:
          err.code === "ECONNREFUSED"
            ? `Connection refused: The server at ${ip} might be offline or not exposing status on port ${serverStatsPort}`
            : err.code === "ENOTFOUND"
            ? `Invalid IP address: ${ip}`
            : "No stats available for this server.",
      })}\n\n`
    );
    reply.raw.end();
  });

  req.raw.on("close", () => {
    request.destroy();
  });
}

export async function create(
  req: FastifyRequest<{ Body: SCH.FromCreateServerBody }>,
  reply: FastifyReply
) {
  const server = await S.createServer(req.body as any, {
    redis: req.server.redis,
  });
  return reply.code(201).send({ success: true, data: server });
}

export async function createMultiple(
  req: FastifyRequest<{ Body: SCH.FromCreateMultipleServersBody }>,
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
  req: FastifyRequest<{
    Params: SCH.FromParamsWithId;
    Body: SCH.FromUpdateServerBody;
  }>,
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
  req: FastifyRequest<{
    Params: SCH.FromParamsWithId;
    Body: SCH.FromUpdateModeBody;
  }>,
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
  req: FastifyRequest<{
    Params: SCH.FromParamsWithId;
    Body: SCH.FromUpdateIsProBody;
  }>,
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
    Params: SCH.FromParamsWithId;
    Body: SCH.FromUpdateOpenVPNConfigBody;
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
    Params: SCH.FromParamsWithId;
    Body: SCH.FromUpdateWireguardConfigBody;
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
  req: FastifyRequest<{ Params: SCH.FromParamsWithId }>,
  reply: FastifyReply
) {
  const ok = await S.deleteServer(req.params.id, { redis: req.server.redis });
  if (!ok)
    return reply
      .code(404)
      .send({ success: false, message: "Server not found" });
  return reply.send({ success: true });
}

export async function removeMany(
  req: FastifyRequest<{ Body: SCH.FromDeleteMultipleServers }>,
  reply: FastifyReply
) {
  const { ids } = req.body;

  const ok = await S.deleteMultipleServers(ids, { redis: req.server.redis });
  if (!ok) {
    return reply
      .code(404)
      .send({ success: false, message: "No servers deleted" });
  }

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
