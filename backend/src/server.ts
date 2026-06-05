import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { getAllowedCorsOrigins } from "./config/cors";
import { getDatabaseTarget } from "./lib/database-status";
import { prisma } from "./lib/prisma";
import { initializeRealtime } from "./lib/realtime";

const app = createApp();
const httpServer = createServer(app);

httpServer.keepAliveTimeout = 65_000;
httpServer.headersTimeout = 66_000;
httpServer.requestTimeout = 120_000;

initializeRealtime(httpServer);

const server = httpServer.listen(env.PORT, () => {
  const databaseTarget = getDatabaseTarget(env.DATABASE_URL);

  console.log(`LMS API listening on http://localhost:${env.PORT}`);
  console.log("LMS deployment target", {
    database: databaseTarget,
    corsOrigins: getAllowedCorsOrigins()
  });
});

async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down API server.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
