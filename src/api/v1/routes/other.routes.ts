import { FastifyInstance } from "fastify";
import * as C from "../controllers/other.controller";
import { otherSchema } from "../../../schemas/other.schema";

export default async function otherRoutes(app: FastifyInstance) {
  app.addHook("onRoute", (opts) => {
    opts.schema = {
      ...(opts.schema || {}),
      tags: ["other-routes"],
      security: [{ bearerAuth: [] }],
    };
  });
  app.get(
    "/redis/reset",
    // { schema: {}, preHandler: verifyToken },
    C.flushRedis
  );
  app.post<{ Params: { ip: string } }>(
    "/server-down/:ip",
    { schema: otherSchema },
    C.ServerDown
  );
}
