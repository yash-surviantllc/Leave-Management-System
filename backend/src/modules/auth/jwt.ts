import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../../config/env";

type AccessTokenPayload = {
  sub: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
};

type RawAccessTokenPayload = {
  sub?: unknown;
  email?: unknown;
  roles?: unknown;
  iat?: unknown;
  exp?: unknown;
};

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(input: string): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(input)
    .digest("base64url");
}

function isTokenPayload(payload: RawAccessTokenPayload): payload is AccessTokenPayload {
  return (
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    Array.isArray(payload.roles) &&
    payload.roles.every((role) => typeof role === "string") &&
    typeof payload.iat === "number" &&
    typeof payload.exp === "number"
  );
}

export function signAccessToken(input: {
  id: string;
  email: string;
  roles: string[];
}): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: input.id,
    email: input.email,
    roles: input.roles,
    iat: issuedAt,
    exp: issuedAt + env.JWT_EXPIRES_IN_SECONDS
  };
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const body = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;

  return `${body}.${sign(body)}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signedBody = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(signedBody);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as RawAccessTokenPayload;

    if (!isTokenPayload(payload)) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
