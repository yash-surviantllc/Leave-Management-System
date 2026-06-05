import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

const shouldLogQueries =
  process.env.NODE_ENV === "development" && process.env.PRISMA_QUERY_LOGS === "true";

function getDatabaseUrlWithPooling(input: {
  databaseUrl: string;
  connectionLimit: number;
  poolTimeoutSeconds: number;
}): string {
  const url = new URL(input.databaseUrl);

  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", String(input.connectionLimit));
  }

  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", String(input.poolTimeoutSeconds));
  }

  return url.toString();
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrlWithPooling({
        databaseUrl: env.DATABASE_URL,
        connectionLimit: env.PRISMA_CONNECTION_LIMIT,
        poolTimeoutSeconds: env.PRISMA_POOL_TIMEOUT_SECONDS
      })
    }
  },
  log: shouldLogQueries ? ["query", "error", "warn"] : ["error"]
});
