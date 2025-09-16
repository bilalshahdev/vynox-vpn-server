// src/routes/dropdown.route.ts
import { FastifyInstance } from "fastify";
import * as DropdownController from "../controllers/dropdown.controller";
import {
  listDropdownsSchema,
  getDropdownByIdSchema,
  getDropdownByNameSchema,
  createDropdownSchema,
  updateDropdownSchema,
  addDropdownValueSchema,
  updateDropdownValueSchema,
  removeDropdownValueSchema,
  paramsWithIdSchema,
} from "../../../schemas/dropdown.schema";

export default async function dropdownRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (routeOptions) => {
    routeOptions.schema = {
      ...(routeOptions.schema || {}),
      tags: ["dropdowns"],
      security: [{ bearerAuth: [] }],
    };
  });

  // GET /dropdowns
  app.get("/", { schema: listDropdownsSchema }, DropdownController.list);

  // GET /dropdowns/:id
  app.get(
    "/:id",
    { schema: getDropdownByIdSchema },
    DropdownController.getById
  );

  // GET /dropdowns/name/:name
  app.get(
    "/name/:name",
    { schema: getDropdownByNameSchema },
    DropdownController.getByName
  );

  // POST /dropdowns
  app.post("/", { schema: createDropdownSchema }, DropdownController.create);

  // PATCH /dropdowns/:id
  app.patch(
    "/:id",
    { schema: updateDropdownSchema },
    DropdownController.update
  );

  // PATCH /dropdowns/:id/values/add
  app.patch(
    "/:id/values/add",
    { schema: addDropdownValueSchema },
    DropdownController.addValue
  );

  // PATCH /dropdowns/:id/values/update
  app.patch(
    "/:id/values/update",
    { schema: updateDropdownValueSchema },
    DropdownController.updateValue
  );

  // PATCH /dropdowns/:id/values/remove
  app.patch(
    "/:id/values/remove",
    { schema: removeDropdownValueSchema },
    DropdownController.removeValue
  );

  // DELETE /dropdowns/:id
  app.delete(
    "/:id",
    { schema: { params: paramsWithIdSchema } },
    DropdownController.remove
  );
}
