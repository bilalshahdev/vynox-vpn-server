// src/routes/server.route.ts
import { FastifyInstance } from "fastify";
import * as S from "../../../schemas/server.schema";
import { verifyToken } from "../../../utils/tokens";
import * as C from "../controllers/server.controller";

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
    C.listServers
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
    C.listGroupedServers
  );

  // GET /servers/:id
  app.get("/:id", { schema: S.getServerByIdSchema }, C.getById);

  // POST /servers
  // req: FastifyRequest<{ Body: FromCreateServerBody }>
  app.post<{ Body: S.FromCreateServerBody }>(
    "/",
    { schema: S.createServerSchema },
    C.create
  );

  app.post<{ Body: S.FromCreateMultipleServersBody }>(
    "/bulk",
    { schema: S.createMultipleServersSchema },
    C.createMultiple
  );

  // PATCH /servers/:id
  app.patch<{ Params: S.FromParamsWithId; Body: S.FromUpdateServerBody }>(
    "/:id",
    { schema: S.updateServerSchema, preHandler: verifyToken },
    C.update
  );

  // PATCH /servers/:id/mode
  app.patch<{ Params: S.FromParamsWithId; Body: S.FromUpdateModeBody }>(
    "/:id/mode",
    { schema: S.updateServerModeSchema, preHandler: verifyToken },
    C.updateMode
  );

  // PATCH /servers/:id/is-pro
  app.patch<{ Params: S.FromParamsWithId; Body: S.FromUpdateIsProBody }>(
    "/:id/is-pro",
    { schema: S.updateServerIsProSchema, preHandler: verifyToken },
    C.updateIsPro
  );

  // PATCH /servers/:id/openvpn-config
  app.patch<{
    Params: S.FromParamsWithId;
    Body: S.FromUpdateOpenVPNConfigBody;
  }>(
    "/:id/openvpn-config",
    { schema: S.updateOpenVPNConfigSchema, preHandler: verifyToken },
    C.updateOpenVPNConfig
  );

  // PATCH /servers/:id/wireguard-config
  app.patch<{
    Params: S.FromParamsWithId;
    Body: S.FromUpdateWireguardConfigBody;
  }>(
    "/:id/wireguard-config",
    { schema: S.updateWireguardConfigSchema, preHandler: verifyToken },
    C.updateWireguardConfig
  );

  // DELETE /servers/:id
  app.delete<{ Params: S.FromParamsWithId }>(
    "/:id",
    { schema: { params: S.paramsWithIdSchema }, preHandler: verifyToken },
    C.remove
  );

  app.post<{ Params: { ip: string } }>(
    "/server-down/:ip",
    { schema: S.serverDownSchema },
    C.ServerDown
  );
}
