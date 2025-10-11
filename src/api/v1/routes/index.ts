import { FastifyInstance } from "fastify";
import serverRoutes from "./server.routes";
import adRoutes from "./ad.routes";
import feedbackRoutes from "./feedback.routes";
import connectivityRoutes from "./connectivity.routes";
import dropdownRoutes from "./dropdown.routes";
import pageRoutes from "./page.routes";
import dashboardRoutes from "./dashboard.route";
import authRoutes from "./auth.route";
import otherRoutes from "./other.routes";
import countryRoutes from "./country.route";
import cityRoutes from "./city.route";
import faqRoutes from "./faq.route";

export default async function usersRoutesV1(app: FastifyInstance) {
  app.get("/", async () => ({ message: "Hello from v1 of fastify" }));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(dashboardRoutes, { prefix: "/dashboard" });
  await app.register(serverRoutes, { prefix: "/servers" });
  await app.register(countryRoutes, { prefix: "/countries" });
  await app.register(cityRoutes, { prefix: "/cities" });
  await app.register(adRoutes, { prefix: "/ads" });
  await app.register(feedbackRoutes, { prefix: "/feedbacks" });
  await app.register(connectivityRoutes, { prefix: "/connectivity" });
  await app.register(dropdownRoutes, { prefix: "/dropdowns" });
  await app.register(pageRoutes, { prefix: "/pages" });
  await app.register(faqRoutes, { prefix: "/faqs" });
  await app.register(otherRoutes, { prefix: "/" });
}
