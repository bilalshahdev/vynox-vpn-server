// src/routes/connectivity.route.ts
import { FastifyInstance } from "fastify";
import * as ConnectivityController from "../controllers/connectivity.controller";
import {
  listConnectivitySchema,
  getConnectivityByIdSchema,
  createConnectivitySchema,
  updateDisconnectedAtSchema,
  paramsWithIdSchema,
} from "../../../schemas/connectivity.schema";

export default async function connectivityRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (routeOptions) => {
    routeOptions.schema = {
      ...(routeOptions.schema || {}),
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

  // POST /connectivity
  app.post(
    "/",
    { schema: createConnectivitySchema },
    ConnectivityController.create
  );

  // PATCH /connectivity/:id/disconnected-at
  app.patch(
    "/:id/disconnected-at",
    { schema: updateDisconnectedAtSchema },
    ConnectivityController.updateDisconnectedAt
  );

  // DELETE /connectivity/:id
  app.delete(
    "/:id",
    { schema: { params: paramsWithIdSchema } },
    ConnectivityController.remove
  );
}
