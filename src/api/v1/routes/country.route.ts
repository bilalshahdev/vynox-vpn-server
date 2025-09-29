// src/routes/country.route.ts
import { FastifyInstance } from "fastify";
import {
  listCountriesSchema,
  searchCountriesSchema,
  countryIdParams,
  createCountrySchema,
  updateCountrySchema,
} from "../../../schemas/country.schema";
import * as CountryController from "../controllers/country.controller";

export default async function countryRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["countries"],
      security: [{ bearerAuth: [] }],
    };
  });

  app.get(
    "/",
    {
      schema: { ...listCountriesSchema, summary: "List countries (paginated)" },
    },
    CountryController.list
  );
  app.get(
    "/search",
    { schema: { ...searchCountriesSchema, summary: "Search countries" } },
    CountryController.search
  );

  app.post(
    "/",
    { schema: { ...createCountrySchema, summary: "Create country" } },
    (await import("../controllers/country.controller")).create
  );
  app.patch(
    "/:id",
    { schema: { ...updateCountrySchema, summary: "Update country" } },
    (await import("../controllers/country.controller")).update
  );
  app.delete(
    "/:id",
    { schema: { params: countryIdParams, summary: "Delete country" } },
    (await import("../controllers/country.controller")).remove
  );
}
