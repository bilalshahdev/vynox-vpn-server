// src/routes/dashboard.route.ts
import { FastifyInstance } from "fastify";
import * as DashboardController from "../controllers/dashboard.controller";
import { getDashboardSchema } from "../../../schemas/dashboard.schema";

export default async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (routeOptions) => {
    routeOptions.schema = {
      ...(routeOptions.schema || {}),
      tags: ["dashboard"],
      security: [{ bearerAuth: [] }],
      summary: "Admin dashboard stats",
      description:
        "Lightweight, cached metrics for the admin dashboard. Uses short-lived Redis caching and index-friendly queries.",
    };
  });

  // GET /dashboard
  app.get(
    "/",
    { schema: getDashboardSchema },
    DashboardController.getDashboard
  );
}
