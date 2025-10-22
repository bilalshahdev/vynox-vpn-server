// /routes/connectivity.routes.ts

import { FastifyInstance } from "fastify";
import {
  connectSchema,
  disconnectSchema,
  getConnectivityByIdSchema,
  openByPairQuerySchema,
  paramsWithIdSchema,
  serversWithStatsSchema,
} from "../../../schemas/connectivity.schema";
import * as C from "../controllers/connectivity.controller";

export default async function connectivityRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["connectivity"],
      security: [{ bearerAuth: [] }],
    };
  });

  app.get(
    "/servers",
    { schema: serversWithStatsSchema },
    C.serverListWithStats
  );

  // GET /connectivity/:id
  app.get("/:id", { schema: getConnectivityByIdSchema }, C.getById);

  // GET /connectivity/open?user_id&server_id (optional convenience)
  app.get("/open", { schema: openByPairQuerySchema }, C.getOpenByPair);

  // POST /connectivity/connect
  app.post("/connect", { schema: connectSchema }, C.connect);

  // POST /connectivity/disconnect
  app.post("/disconnect", { schema: disconnectSchema }, C.disconnect);

  // DELETE /connectivity/:id
  app.delete("/:id", { schema: { params: paramsWithIdSchema } }, C.remove);
}
