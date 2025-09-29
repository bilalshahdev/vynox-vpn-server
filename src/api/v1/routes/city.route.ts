// src/routes/city.route.ts
import { FastifyInstance } from "fastify";
import {
  listCitiesSchema,
  searchCitiesSchema,
  cityIdParams,
  createCitySchema,
  updateCitySchema,
} from "../../../schemas/city.schema";
import * as CityController from "../controllers/city.controller";

export default async function cityRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["cities"],
      security: [{ bearerAuth: [] }],
    };
  });

  app.get(
    "/",
    { schema: { ...listCitiesSchema, summary: "List cities (paginated)" } },
    CityController.list
  );
  app.get(
    "/search",
    { schema: { ...searchCitiesSchema, summary: "Search cities" } },
    CityController.search
  );

  app.post(
    "/",
    { schema: { ...createCitySchema, summary: "Create city" } },
    (await import("../controllers/city.controller")).create
  );
  app.patch(
    "/:id",
    { schema: { ...updateCitySchema, summary: "Update city" } },
    (await import("../controllers/city.controller")).update
  );
  app.delete(
    "/:id",
    { schema: { params: cityIdParams, summary: "Delete city" } },
    (await import("../controllers/city.controller")).remove
  );
}
