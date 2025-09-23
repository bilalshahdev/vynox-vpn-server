import { FastifyInstance } from "fastify";
import * as ConnectivityController from "../controllers/connectivity.controller";
import {
  listConnectivitySchema,
  getConnectivityByIdSchema,
  connectSchema,
  disconnectSchema,
  paramsWithIdSchema,
  openByPairQuerySchema,
} from "../../../schemas/connectivity.schema";

export default async function connectivityRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["connectivity"],
      security: [{ bearerAuth: [] }],
    };
  });

  // GET /connectivity
  app.get("/", { schema: listConnectivitySchema }, ConnectivityController.list);

  // GET /connectivity/:id
  app.get(
    "/:id",
    { schema: getConnectivityByIdSchema },
    ConnectivityController.getById
  );

  // GET /connectivity/open?user_id&server_id (optional convenience)
  app.get(
    "/open",
    { schema: openByPairQuerySchema },
    ConnectivityController.getOpenByPair
  );

  // POST /connectivity/connect
  app.post(
    "/connect",
    { schema: connectSchema },
    ConnectivityController.connect
  );

  // POST /connectivity/disconnect
  app.post(
    "/disconnect",
    { schema: disconnectSchema },
    ConnectivityController.disconnect
  );

  // DELETE /connectivity/:id
  app.delete(
    "/:id",
    { schema: { params: paramsWithIdSchema } },
    ConnectivityController.remove
  );
}
