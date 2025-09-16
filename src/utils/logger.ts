import { config } from "../config";

export default function createLoggerConfig(): true | Record<string, unknown> {
  if (config.app.env !== "development") return true;

  try {
    require.resolve("pino-pretty");
    return {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          singleLine: true,
          ignore: "pid,hostname",
        },
      },
    };
  } catch {
    return true;
  }
}
