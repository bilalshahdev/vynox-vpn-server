// src/routes/page.route.ts
import { FastifyInstance } from "fastify";
import * as PageController from "../controllers/page.controller";
import {
  listPagesSchema,
  getPageByIdSchema,
  getPageByTypeSchema,
  createPageSchema,
  updatePageSchema,
  paramsWithIdSchema,
} from "../../../schemas/page.schema";

export default async function pageRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (routeOptions) => {
    routeOptions.schema = {
      ...(routeOptions.schema || {}),
      tags: ["pages"],
      security: [{ bearerAuth: [] }],
    };
  });

  // GET /pages
  app.get("/", { schema: listPagesSchema }, PageController.list);

  // GET /pages/type/:type
  app.get(
    "/type/:type",
    { schema: getPageByTypeSchema },
    PageController.getByType
  );

  // GET /pages/:id
  app.get("/:id", { schema: getPageByIdSchema }, PageController.getById);

  // POST /pages
  app.post("/", { schema: createPageSchema }, PageController.create);

  // PATCH /pages/:id
  app.patch("/:id", { schema: updatePageSchema }, PageController.update);

  // DELETE /pages/:id
  app.delete(
    "/:id",
    { schema: { params: paramsWithIdSchema } },
    PageController.remove
  );
}
