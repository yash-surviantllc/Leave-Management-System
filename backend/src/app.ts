import cors from "cors";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { authRouter } from "./modules/auth/auth.routes";
import { attendanceRouter } from "./modules/attendance/attendance.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { employeeCoreRouter } from "./modules/employees/employees.routes";
import { healthRouter } from "./modules/health/health.routes";
import { leaveRouter } from "./modules/leaves/leaves.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { reportsRouter } from "./modules/reports/reports.routes";

function getAllowedCorsOrigins(): string[] {
  const origins = new Set([
    env.CORS_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://lms-frontend-tawny.vercel.app"
  ]);

  return [...origins];
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: getAllowedCorsOrigins(),
      credentials: true
    })
  );
  app.use(express.json({ limit: "5mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", employeeCoreRouter);
  app.use("/api", attendanceRouter);
  app.use("/api", leaveRouter);
  app.use("/api", dashboardRouter);
  app.use("/api", reportsRouter);
  app.use("/api", notificationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
