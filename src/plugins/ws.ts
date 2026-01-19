import websocket from "@fastify/websocket";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import WebSocket from "ws";
import { bus } from "../events/bus";

type WsQuery = { token?: string };

const wsPlugin: FastifyPluginAsync = async (app) => {
  await app.register(websocket);

  const clients = new Set<WebSocket>();

  app.get(
    "/ws",
    { websocket: true },
    (connection: WebSocket, req: FastifyRequest<{ Querystring: WsQuery }>) => {
      const ws = connection;

      const token = req.query?.token;
      if (!token) {
        ws.close(1008, "Missing token");
        return;
      }

      try {
        (ws as any).user_id = "decoded_user_id";
      } catch {
        ws.close(1008, "Invalid token");
        return;
      }

      clients.add(ws);

      ws.on("close", () => {
        clients.delete(ws);
      });

      ws.send(
        JSON.stringify({
          type: "system.connected",
          time: new Date().toISOString(),
        })
      );
    }
  );

  const broadcast = (event: any) => {
    const msg = JSON.stringify(event);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  };

  bus.on("connectivity.connected", (payload) => {
    broadcast({ type: "connectivity.connected", payload });
  });

  bus.on("connectivity.disconnected", (payload) => {
    broadcast({ type: "connectivity.disconnected", payload });
  });

  bus.on("feedback.created", (payload) => {
    app.log.info({ payload }, "[WS] feedback.created");
    broadcast({ type: "feedback.created", payload });
  });

  bus.on("feedback.deleted", (payload) => {
    app.log.info({ payload }, "[WS] feedback.deleted");
    broadcast({ type: "feedback.deleted", payload });
  });

  app.addHook("onClose", async () => {
    bus.removeAllListeners("connectivity.connected");
    bus.removeAllListeners("connectivity.disconnected");
    bus.removeAllListeners("feedback.created");
    bus.removeAllListeners("feedback.deleted");
  });
};

export default fp(wsPlugin);
