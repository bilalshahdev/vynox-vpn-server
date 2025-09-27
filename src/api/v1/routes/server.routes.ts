// src/routes/server.route.ts
import { FastifyInstance } from "fastify";
import * as S from "../../../schemas/server.schema";
import { verifyToken } from "../../../utils/tokens";
import * as ServerController from "../controllers/server.controller";

export default async function serverRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["servers"],
      security: [{ bearerAuth: [] }],
    };
  });

  app.get(
    "/",
    {
      schema: {
        ...S.listServersSchema,
        summary: "List servers",
        description:
          "List servers filtered by optional os_type with pagination.",
      },
    },
    ServerController.listServers
  );

  app.get(
    "/grouped",
    {
      schema: {
        ...S.listGroupedServersSchema,
        summary: "List grouped servers",
        description: "List servers grouped by country with pagination.",
      },
    },
    ServerController.listGroupedServers
  );

  // GET /servers/:id
  app.get("/:id", { schema: S.getServerByIdSchema }, ServerController.getById);

  // POST /servers
  // req: FastifyRequest<{ Body: FromCreateServerBody }>
  app.post<{ Body: S.FromCreateServerBody }>(
    "/",
    { schema: S.createServerSchema, preHandler: verifyToken },
    ServerController.create
  );

  // PATCH /servers/:id
  app.patch<{ Params: S.FromParamsWithId; Body: S.FromUpdateServerBody }>(
    "/:id",
    { schema: S.updateServerSchema, preHandler: verifyToken },
    ServerController.update
  );

  // PATCH /servers/:id/mode
  app.patch<{ Params: S.FromParamsWithId; Body: S.FromUpdateModeBody }>(
    "/:id/mode",
    { schema: S.updateServerModeSchema, preHandler: verifyToken },
    ServerController.updateMode
  );

  // PATCH /servers/:id/is-pro
  app.patch<{ Params: S.FromParamsWithId; Body: S.FromUpdateIsProBody }>(
    "/:id/is-pro",
    { schema: S.updateServerIsProSchema, preHandler: verifyToken },
    ServerController.updateIsPro
  );

  // PATCH /servers/:id/openvpn-config
  app.patch<{
    Params: S.FromParamsWithId;
    Body: S.FromUpdateOpenVPNConfigBody;
  }>(
    "/:id/openvpn-config",
    { schema: S.updateOpenVPNConfigSchema, preHandler: verifyToken },
    ServerController.updateOpenVPNConfig
  );

  // PATCH /servers/:id/wireguard-config
  app.patch<{
    Params: S.FromParamsWithId;
    Body: S.FromUpdateWireguardConfigBody;
  }>(
    "/:id/wireguard-config",
    { schema: S.updateWireguardConfigSchema, preHandler: verifyToken },
    ServerController.updateWireguardConfig
  );

  // DELETE /servers/:id
  app.delete<{ Params: S.FromParamsWithId }>(
    "/:id",
    { schema: { params: S.paramsWithIdSchema }, preHandler: verifyToken },
    ServerController.remove
  );
}
