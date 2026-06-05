import type { RequestHandler } from "express";
import { verifyAccessToken } from "../modules/auth/jwt";
import { getAuthUserById } from "../modules/auth/auth.service";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "./error-handler";

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const authorization = req.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "A valid access token is required");
  }

  const token = authorization.slice("Bearer ".length).trim();
  const payload = verifyAccessToken(token);

  if (!payload) {
    throw new AppError(401, "INVALID_ACCESS_TOKEN", "The access token is invalid or expired");
  }

  const user = await getAuthUserById(payload.sub);

  if (!user) {
    throw new AppError(401, "INVALID_ACCESS_TOKEN", "The access token user no longer exists");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "ACCOUNT_NOT_ACTIVE", "This account is not active");
  }

  req.auth = user;
  next();
});
