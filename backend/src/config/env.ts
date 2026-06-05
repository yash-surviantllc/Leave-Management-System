import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const defaultDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5432/lms?schema=public";
const defaultJwtSecret = "local-development-jwt-secret-change-me-32";
const exampleJwtSecret = "replace-with-a-random-secret-at-least-32-characters";
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const emptyStringToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;
const isValidTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};
const corsOriginsSchema = z.string().superRefine((value, context) => {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one CORS origin is required"
    });
    return;
  }

  origins.forEach((origin) => {
    try {
      new URL(origin);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid CORS origin: ${origin}`
      });
    }
  });
});

if (!hasDatabaseUrl) {
  process.env.DATABASE_URL = defaultDatabaseUrl;
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  CORS_ORIGIN: corsOriginsSchema.default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default(defaultDatabaseUrl),
  JWT_SECRET: z.string().min(32).default(defaultJwtSecret),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(86_400),
  PASSWORD_RESET_EXPIRES_IN_MINUTES: z.coerce.number().int().positive().default(30),
  REDIS_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  DASHBOARD_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  PRISMA_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  PRISMA_POOL_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(20),
  BUSINESS_TIME_ZONE: z.string().min(1).default("Asia/Kolkata").refine(isValidTimeZone),
  GEMINI_API_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash"),
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(65_536).default(700)
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === "production") {
  if (!hasDatabaseUrl) {
    throw new Error("DATABASE_URL must be set explicitly in production");
  }

  const databaseUrl = new URL(env.DATABASE_URL);

  if (databaseUrl.hostname === "localhost" || databaseUrl.hostname === "127.0.0.1") {
    throw new Error("DATABASE_URL must point to the deployed Neon database in production");
  }

  if (env.JWT_SECRET === defaultJwtSecret || env.JWT_SECRET === exampleJwtSecret) {
    throw new Error("JWT_SECRET must be changed from the development/example value in production");
  }
}
