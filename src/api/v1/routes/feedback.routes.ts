// src/routes/feedback.route.ts
import { FastifyInstance } from "fastify";
import {
  createFeedbackSchema,
  getFeedbackByIdSchema,
  listFeedbackSchema,
  paramsWithIdSchema,
} from "../../../schemas/feedback.schema";
import * as FeedbackController from "../controllers/feedback.controller";

export default async function feedbackRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (routeOptions) => {
    routeOptions.schema = {
      ...(routeOptions.schema || {}),
      tags: ["feedback"],
      security: [{ bearerAuth: [] }],
    };
  });

  // GET /feedback
  app.get("/", { schema: listFeedbackSchema }, FeedbackController.list);

  // GET /feedback/:id
  app.get(
    "/:id",
    { schema: getFeedbackByIdSchema },
    FeedbackController.getById
  );

  // POST /feedback
  app.post("/", { schema: createFeedbackSchema }, FeedbackController.create);

  // DELETE /feedback/:id
  app.delete(
    "/:id",
    { schema: { params: paramsWithIdSchema } },
    FeedbackController.remove
  );
}
