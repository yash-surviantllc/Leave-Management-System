import type { RequestHandler } from "express";
import { AppError } from "./error-handler";

export function requirePermissions(requiredPermissions: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "A valid access token is required");
    }

    const permissions = new Set(req.auth.permissions);
    const missingPermission = requiredPermissions.find(
      (permission) => !permissions.has(permission)
    );

    if (missingPermission) {
      throw new AppError(403, "PERMISSION_DENIED", "This account cannot perform that action", {
        missingPermission
      });
    }

    next();
  };
}

export function requireAnyPermission(requiredPermissions: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "A valid access token is required");
    }

    const permissions = new Set(req.auth.permissions);
    const hasPermission = requiredPermissions.some((permission) =>
      permissions.has(permission)
    );

    if (!hasPermission) {
      throw new AppError(403, "PERMISSION_DENIED", "This account cannot perform that action", {
        requiredPermissions
      });
    }

    next();
  };
}
