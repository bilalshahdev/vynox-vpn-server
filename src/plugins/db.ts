import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import mongoose from "mongoose";
import { config } from "../config";

// src/plugins/db.ts
export default fp(async (app) => {
  mongoose.set("debug", false);
  await mongoose.connect(config.db.mongoUri, {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS: 20000,
    // If using replica set and read-heavy:
    // readPreference: 'secondaryPreferred' as any,
    // compressors: ['zstd'], // if network latency is non-trivial
    autoIndex: false, // IMPORTANT: build indexes offline
    bufferCommands: false,
  } as any);

  app.decorate("mongo", mongoose);
  app.addHook("onClose", async () => mongoose.disconnect());
});

declare module "fastify" {
  interface FastifyInstance {
    mongo: typeof mongoose;
  }
}
