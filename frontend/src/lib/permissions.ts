import type { AuthUser, RoleName } from "@/types";

export const roleLabels: Record<RoleName, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee"
};

export function hasEveryPermission(
  user: AuthUser,
  requiredPermissions: string[]
): boolean {
  const permissions = new Set(user.permissions);

  return requiredPermissions.every((permission) => permissions.has(permission));
}

export function hasAnyPermission(
  user: AuthUser,
  requiredPermissions: string[]
): boolean {
  const permissions = new Set(user.permissions);

  return requiredPermissions.some((permission) => permissions.has(permission));
}
