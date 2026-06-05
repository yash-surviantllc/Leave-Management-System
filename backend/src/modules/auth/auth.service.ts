import { createHash, randomBytes } from "crypto";
import type { AccountStatus } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  roles: string[];
  permissions: string[];
};

type UserAccessRecord = {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  roles: Array<{
    role: {
      name: string;
      permissions: Array<{
        permission: {
          key: string;
        };
      }>;
    };
  }>;
};

function toAuthUser(user: UserAccessRecord): AuthUser {
  const roles = user.roles.map((userRole) => userRole.role.name);
  const permissions = new Set<string>();

  user.roles.forEach((userRole) => {
    userRole.role.permissions.forEach((rolePermission) => {
      permissions.add(rolePermission.permission.key);
    });
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    roles,
    permissions: Array.from(permissions).sort()
  };
}

export async function getAuthUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    return null;
  }

  return toAuthUser(user);
}

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getPasswordResetExpiry(): Date {
  return new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_IN_MINUTES * 60_000);
}
