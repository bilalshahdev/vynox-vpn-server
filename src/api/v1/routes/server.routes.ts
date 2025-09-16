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
} from "../../../schemas/server.schema";

export default async function serverRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (routeOptions) => {
    routeOptions.schema = {
      ...(routeOptions.schema || {}),
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

  // GET /servers/:id
  app.get("/:id", { schema: getServerByIdSchema }, ServerController.getById);

  // POST /servers
  app.post("/", { schema: createServerSchema }, ServerController.create);

  // PATCH /servers/:id
  app.patch("/:id", { schema: updateServerSchema }, ServerController.update);

  // PATCH /servers/:id/mode
  app.patch(
    "/ :id/mode".replace(" ", ""),
    { schema: updateServerModeSchema },
    ServerController.updateMode
  );

  // PATCH /servers/:id/is-pro
  app.patch(
    "/ :id/is-pro".replace(" ", ""),
    { schema: updateServerIsProSchema },
    ServerController.updateIsPro
  );

  // PATCH /servers/:id/openvpn-config
  app.patch(
    "/ :id/openvpn-config".replace(" ", ""),
    { schema: updateOpenVPNConfigSchema },
    ServerController.updateOpenVPNConfig
  );

  // PATCH /servers/:id/wireguard-config
  app.patch(
    "/ :id/wireguard-config".replace(" ", ""),
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
