import * as dotenv from "dotenv";
import path from "path";

// pick env file based on APP_ENV or NODE_ENV
const envFile = `.env.${
  process.env.APP_ENV || process.env.NODE_ENV || "development"
}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

function required(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  app: {
    env: required("APP_ENV", "development"),
    port: Number(required("PORT", "3000")),
    version: required("APP_VERSION", "1"),
  },
  db: {
    mongoUri: required("MONGO_URI"),
  },
  redis: {
    url: required("REDIS_URL"),
  },
  auth: {
    jwtSecret: required("JWT_SECRET"),
  },
  swagger: {
    enabled: required("SWAGGER_UI_ENABLED", "false") === "true",
  },
  cors: {
    origins: required("CORS_ORIGINS", "")
      .split(",")
      .map((o) => {
        // regex origins are written like `/^https:\/\/.+\.example\.com$/`
        if (o.startsWith("/") && o.endsWith("/")) {
          return new RegExp(o.slice(1, -1));
        }
        return o;
      }),
  },
};
