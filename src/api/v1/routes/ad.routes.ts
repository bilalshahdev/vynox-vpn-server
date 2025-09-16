// src/routes/ad.route.ts
import { FastifyInstance } from "fastify";
import * as AdController from "../controllers/ad.controller";
import {
  listAdsSchema,
  getAdByIdSchema,
  createAdSchema,
  updateAdSchema,
  updateAdStatusSchema,
  paramsWithIdSchema,
} from "../../../schemas/ad.schema";

export default async function adRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["ads"],
      security: [{ bearerAuth: [] }],
    };
  });

  // GET /ads  (use os_type as a query param)
  app.get(
    "/",
    {
      schema: {
        ...listAdsSchema,
        summary: "List ads",
        description:
          "List ads with optional filters (os_type, type, position, status) and pagination.",
      },
    },
    AdController.listAds
  );

  // GET /ads/:id
  app.get(
    "/:id",
    { schema: { ...getAdByIdSchema, summary: "Get ad by id" } },
    AdController.getById
  );

  // POST /ads
  app.post(
    "/",
    { schema: { ...createAdSchema, summary: "Create ad" } },
    AdController.create
  );

  // PATCH /ads/:id
  app.patch(
    "/:id",
    { schema: { ...updateAdSchema, summary: "Update ad" } },
    AdController.update
  );

  // PATCH /ads/:id/status
  app.patch(
    "/:id/status",
    {
      schema: {
        ...updateAdStatusSchema,
        summary: "Update ad status",
        description: "Toggle ad status (enable/disable).",
      },
    },
    AdController.updateStatus
  );

  // DELETE /ads/:id
  app.delete(
    "/:id",
    { schema: { params: paramsWithIdSchema, summary: "Delete ad" } },
    AdController.remove
  );
}
