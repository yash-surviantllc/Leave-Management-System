import { env } from "./env";

const knownHostedOrigins = ["https://lms-frontend-tawny.vercel.app"];

function toOrigin(value: string): string {
  return new URL(value).origin;
}

function addLocalhostPair(origins: Set<string>, origin: string): void {
  if (origin === "http://localhost:3000") {
    origins.add("http://127.0.0.1:3000");
  }

  if (origin === "http://127.0.0.1:3000") {
    origins.add("http://localhost:3000");
  }
}

export function getAllowedCorsOrigins(): string[] {
  const origins = new Set<string>();
  const configuredOrigins = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map(toOrigin);

  [...configuredOrigins, ...knownHostedOrigins.map(toOrigin)].forEach((origin) => {
    origins.add(origin);
    addLocalhostPair(origins, origin);
  });

  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return [...origins];
}
