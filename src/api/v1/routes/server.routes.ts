// src/routes/server.route.ts
import { FastifyInstance } from "fastify";
import * as ServerController from "../controllers/server.controller";
import {
  listServersSchema,
  getServerByIdSchema,
  createServerSchema,
  updateServerSchema,
  updateServerModeSchema,
  updateServerIsProSchema,
  updateOpenVPNConfigSchema,
  updateWireguardConfigSchema,
  paramsWithIdSchema,
  listGroupedServersSchema,
} from "../../../schemas/server.schema";

export default async function serverRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["servers"],
      security: [{ bearerAuth: [] }],
    };
  });

  // GET /servers?os_type=android|ios&page=&limit=
  app.get(
    "/",
    {
      schema: {
        ...listServersSchema,
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
        ...listGroupedServersSchema,
        summary: "List grouped servers",
        description: "List servers grouped by country with pagination.",
      },
    },
    ServerController.listGroupedServers
  );

  // GET /servers/:id
  app.get("/:id", { schema: getServerByIdSchema }, ServerController.getById);

  // POST /servers
  app.post("/", { schema: createServerSchema }, ServerController.create);

  // PATCH /servers/:id
  app.patch("/:id", { schema: updateServerSchema }, ServerController.update);

  // PATCH /servers/:id/mode
  app.patch(
    "/:id/mode",
    { schema: updateServerModeSchema },
    ServerController.updateMode
  );

  // PATCH /servers/:id/is-pro
  app.patch(
    "/:id/is-pro",
    { schema: updateServerIsProSchema },
    ServerController.updateIsPro
  );

  // PATCH /servers/:id/openvpn-config
  app.patch(
    "/:id/openvpn-config",
    { schema: updateOpenVPNConfigSchema },
    ServerController.updateOpenVPNConfig
  );

  // PATCH /servers/:id/wireguard-config
  app.patch(
    "/:id/wireguard-config",
    { schema: updateWireguardConfigSchema },
    ServerController.updateWireguardConfig
  );

  // DELETE /servers/:id
  app.delete(
    "/:id",
    { schema: { params: paramsWithIdSchema } },
    ServerController.remove
  );
}
