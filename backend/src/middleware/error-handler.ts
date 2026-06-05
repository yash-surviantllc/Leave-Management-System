import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import {
  getDatabaseSchemaNotReadyDetails,
  getDatabaseUnavailableDetails
} from "../lib/database-status";
import { fail } from "../utils/api-response";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function isPrismaInitializationError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Error && error.name === "PrismaClientInitializationError")
  );
}

function isPrismaDatabaseUnavailableError(error: unknown): boolean {
  return (
    isPrismaInitializationError(error) ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001")
  );
}

function isPrismaSchemaNotReadyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res
      .status(error.statusCode)
      .json(fail(error.code, error.message, error.details));
    return;
  }

  const startedAt = Date.now();

  if (isPrismaDatabaseUnavailableError(error)) {
    res.status(503).json(
      fail(
        "DATABASE_UNAVAILABLE",
        "API is running, but database is unavailable",
        getDatabaseUnavailableDetails(env.DATABASE_URL, startedAt)
      )
    );
    return;
  }

  if (isPrismaSchemaNotReadyError(error)) {
    res.status(503).json(
      fail(
        "DATABASE_SCHEMA_NOT_READY",
        "The database schema is not ready",
        getDatabaseSchemaNotReadyDetails(env.DATABASE_URL, startedAt)
      )
    );
    return;
  }

  console.error(error);

  res.status(500).json(
    fail("INTERNAL_SERVER_ERROR", "Something went wrong on the server")
  );
};
