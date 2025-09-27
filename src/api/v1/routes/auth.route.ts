import { FastifyInstance } from "fastify";
import { loginSchema } from "../../../schemas/auth.schema";
import * as AuthController from "../controllers/auth.controller";

export default async function authRoutes(app: FastifyInstance) {
  // Apply security globally, but skip login route
  app.addHook("onRoute", (opts) => {
    if (opts.url !== "/login") {
      opts.schema = {
        ...(opts.schema || {}),
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
      };
    } else {
      opts.schema = {
        ...(opts.schema || {}),
        tags: ["auth"],
      };
    }
  });

  app.post(
    "/login",
    {
      schema: {
        ...loginSchema,
        summary: "Login",
      },
    },
    AuthController.login
  );
}
