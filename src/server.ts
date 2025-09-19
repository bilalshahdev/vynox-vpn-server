// src/server.ts
import { buildApp } from "./app";
import { config } from "./config";

const server = buildApp();

async function start() {
  try {
    await server.listen({ host: "0.0.0.0", port: config.app.port });
    server.log.info(`🚀 Server running at http://localhost:${config.app.port}`);
  } catch (err) {

    console.log({
      error: err,
      
    })
    server.log.error(err);
    process.exit(1);
  }
}
const shutdown = async () => {
  try {
    await server.close();
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
