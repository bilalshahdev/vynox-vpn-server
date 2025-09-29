// src/routes/faq.route.ts
import { FastifyInstance } from "fastify";
import {
  listFaqsSchema,
  searchFaqsSchema,
  getFaqByIdSchema,
  createFaqSchema,
  updateFaqSchema,
  paramsWithIdSchema,
} from "../../../schemas/faq.schema";
import * as FaqController from "../controllers/faq.controller";

export default async function faqRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["faqs"],
      security: [{ bearerAuth: [] }],
    };
  });

  app.get(
    "/",
    { schema: { ...listFaqsSchema, summary: "List FAQs (paginated)" } },
    FaqController.list
  );
  app.get(
    "/search",
    { schema: { ...searchFaqsSchema, summary: "Search FAQs" } },
    FaqController.search
  );
  app.get(
    "/:id",
    { schema: { ...getFaqByIdSchema, summary: "Get FAQ by id" } },
    FaqController.getById
  );

  app.post(
    "/",
    { schema: { ...createFaqSchema, summary: "Create FAQ" } },
    FaqController.create
  );
  app.patch(
    "/:id",
    { schema: { ...updateFaqSchema, summary: "Update FAQ" } },
    FaqController.update
  );
  app.delete(
    "/:id",
    { schema: { params: paramsWithIdSchema, summary: "Delete FAQ" } },
    FaqController.remove
  );
}
