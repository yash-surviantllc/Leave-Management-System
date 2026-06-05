import { Router } from "express";
import { env } from "../../config/env";
import { getDatabaseUnavailableDetails } from "../../lib/database-status";
import { prisma } from "../../lib/prisma";
import { fail, ok } from "../../utils/api-response";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json(
      ok({
        service: "lms-api",
        api: "running",
        database: "connected",
        uptimeSeconds: Math.round(process.uptime()),
        responseTimeMs: Date.now() - startedAt
      })
    );
  } catch (error) {
    res.status(503).json(
      fail(
        "DATABASE_UNAVAILABLE",
        "API is running, but database is unavailable",
        getDatabaseUnavailableDetails(env.DATABASE_URL, startedAt)
      )
    );
  }
});
