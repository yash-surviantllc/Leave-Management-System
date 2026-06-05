import type { Request } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { getCachedJson, setCachedJson } from "../../lib/cache";
import { getDashboardCacheKey } from "../../lib/dashboard-cache";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/authenticate";
import { requirePermissions } from "../../middleware/authorize";
import { AppError } from "../../middleware/error-handler";
import { ok } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";

export const dashboardRouter = Router();

type DashboardCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "brand" | "blue" | "amber" | "slate";
};

type DashboardSummaryPayload = {
  cards: DashboardCard[];
  notifications: Prisma.NotificationGetPayload<Record<string, never>>[];
  scope: "organization" | "self_or_team";
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveDashboardValue<T>(input: {
  label: string;
  fallback: T;
  failures: string[];
  task: () => Promise<T>;
}): Promise<T> {
  try {
    return await input.task();
  } catch (error) {
    input.failures.push(input.label);
    console.error("Dashboard summary query failed", {
      label: input.label,
      error: getErrorMessage(error)
    });

    return input.fallback;
  }
}

async function readDashboardCache(
  cacheKey: string
): Promise<DashboardSummaryPayload | null> {
  try {
    return await getCachedJson<DashboardSummaryPayload>(cacheKey);
  } catch (error) {
    console.error("Dashboard summary cache read failed", {
      error: getErrorMessage(error)
    });

    return null;
  }
}

async function writeDashboardCache(input: {
  cacheKey: string;
  summary: DashboardSummaryPayload;
  ttlSeconds: number;
}): Promise<void> {
  try {
    await setCachedJson(input.cacheKey, input.summary, input.ttlSeconds);
  } catch (error) {
    console.error("Dashboard summary cache write failed", {
      error: getErrorMessage(error)
    });
  }
}

async function resolveScopedEmployeeWhere(input: {
  req: Request;
  failures: string[];
}): Promise<Prisma.EmployeeWhereInput> {
  return resolveDashboardValue({
    label: "employeeScope",
    fallback: {
      id: "__none__"
    },
    failures: input.failures,
    task: () => getScopedEmployeeWhere(input.req)
  });
}

function assertAuthenticated(req: Request) {
  if (!req.auth) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "A valid access token is required");
  }

  return req.auth;
}

function hasPermission(req: Request, permission: string): boolean {
  return assertAuthenticated(req).permissions.includes(permission);
}

function toDateOnlyFromDate(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function getMonthRange(date: Date): { monthStart: Date; monthEnd: Date } {
  const monthStart = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
  const monthEnd = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0));

  return { monthStart, monthEnd };
}

function getYearRange(date: Date): { yearStart: Date; yearEnd: Date } {
  const yearStart = new Date(Date.UTC(date.getFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(date.getFullYear(), 11, 31));

  return { yearStart, yearEnd };
}

function getUserAudiences(roles: string[]): Array<"ALL" | "SUPER_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE"> {
  return ["ALL", ...roles] as Array<"ALL" | "SUPER_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE">;
}

function shouldBypassDashboardCache(value: unknown): boolean {
  const refreshValue = Array.isArray(value) ? value[0] : value;

  return refreshValue === "true" || refreshValue === "1";
}


async function getScopedEmployeeWhere(req: Request): Promise<Prisma.EmployeeWhereInput> {
  const auth = assertAuthenticated(req);

  if (hasPermission(req, "employees:manage") || hasPermission(req, "reports:read")) {
    return {};
  }

  const employee = await prisma.employee.findUnique({
    where: {
      userId: auth.id
    }
  });

  if (!employee) {
    return {
      id: "__none__"
    };
  }

  if (hasPermission(req, "attendance:read") || hasPermission(req, "leave:approve")) {
    return {
      managerId: employee.id
    };
  }

  return {
    id: employee.id
  };
}

function getScopedUserWhere(req: Request): Prisma.UserWhereInput {
  const auth = assertAuthenticated(req);

  if (hasPermission(req, "employees:manage") || hasPermission(req, "reports:read")) {
    return {};
  }

  return {
    id: auth.id
  };
}

dashboardRouter.use(authenticate);

dashboardRouter.get(
  "/dashboard/summary",
  requirePermissions(["dashboard:read"]),
  asyncHandler(async (req, res) => {
    const auth = assertAuthenticated(req);
    const now = new Date();
    const today = toDateOnlyFromDate(now);
    const { monthStart, monthEnd } = getMonthRange(now);
    const { yearStart, yearEnd } = getYearRange(now);
    const failedSections: string[] = [];
    const cacheKey = getDashboardCacheKey({
      userId: auth.id,
      roles: auth.roles,
      permissions: auth.permissions,
      date: today
    });
    const shouldBypassCache = shouldBypassDashboardCache(req.query.refresh);
    const cachedSummary = shouldBypassCache
      ? null
      : await readDashboardCache(cacheKey);

    if (cachedSummary) {
      res.status(200).json(ok(cachedSummary, { cache: "hit" }));
      return;
    }

    const employeeWhere = await resolveScopedEmployeeWhere({
      req,
      failures: failedSections
    });
    const canSeeOrgMetrics =
      hasPermission(req, "employees:manage") || hasPermission(req, "reports:read");
    const userWhere = getScopedUserWhere(req);
    const [
      employeeCount,
      activeEmployeeCount,
      userCount,
      activeUserCount,
      presentTodayCount,
      employeesOnLeaveCount,
      pendingLeaveCount,
      newHireCount,
      newUserCount,
      exitCount,
      unreadNotifications,
      notificationCandidates
    ] = await Promise.all([
      resolveDashboardValue({
        label: "employeeCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.employee.count({
          where: employeeWhere
        })
      }),
      resolveDashboardValue({
        label: "activeEmployeeCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.employee.count({
          where: {
            ...employeeWhere,
            status: {
              in: ["ONBOARDING", "ACTIVE", "PROBATION"]
            }
          }
        })
      }),
      resolveDashboardValue({
        label: "userCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.user.count({
          where: userWhere
        })
      }),
      resolveDashboardValue({
        label: "activeUserCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.user.count({
          where: {
            ...userWhere,
            status: "ACTIVE"
          }
        })
      }),
      resolveDashboardValue({
        label: "presentTodayCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.attendance.count({
          where: {
            date: today,
            status: {
              in: ["PRESENT", "LATE", "HALF_DAY", "WORK_FROM_HOME"]
            },
            employee: employeeWhere
          }
        })
      }),
      resolveDashboardValue({
        label: "employeesOnLeaveCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.leaveRequest.count({
          where: {
            status: "APPROVED",
            startDate: {
              lte: today
            },
            endDate: {
              gte: today
            },
            employee: employeeWhere
          }
        })
      }),
      resolveDashboardValue({
        label: "pendingLeaveCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.leaveRequest.count({
          where: {
            status: "PENDING",
            employee: employeeWhere
          }
        })
      }),
      resolveDashboardValue({
        label: "newHireCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.employee.count({
          where: {
            ...employeeWhere,
            dateOfJoining: {
              gte: monthStart,
              lte: monthEnd
            }
          }
        })
      }),
      resolveDashboardValue({
        label: "newUserCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.user.count({
          where: {
            ...userWhere,
            createdAt: {
              gte: monthStart,
              lte: monthEnd
            }
          }
        })
      }),
      resolveDashboardValue({
        label: "exitCount",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.employee.count({
          where: {
            ...employeeWhere,
            dateOfExit: {
              gte: yearStart,
              lte: yearEnd
            }
          }
        })
      }),
      resolveDashboardValue({
        label: "unreadNotifications",
        fallback: 0,
        failures: failedSections,
        task: () => prisma.notification.count({
          where: {
            userId: auth.id,
            isRead: false
          }
        })
      }),
      resolveDashboardValue({
        label: "notificationCandidates",
        fallback: [] as Prisma.NotificationGetPayload<Record<string, never>>[],
        failures: failedSections,
        task: () => prisma.notification.findMany({
          where: {
            userId: auth.id
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 20
        })
      }),
          ]);
    const notifications = notificationCandidates.slice(0, 5);
    const useUserMetrics = employeeCount === 0 && userCount > 0;
    const totalPeopleCount = useUserMetrics ? userCount : employeeCount;
    const activePeopleCount = useUserMetrics ? activeUserCount : activeEmployeeCount;
    const monthlyJoinCount = useUserMetrics ? newUserCount : newHireCount;
    const attritionRate =
      canSeeOrgMetrics && !useUserMetrics && activeEmployeeCount + exitCount > 0
        ? `${((exitCount / (activeEmployeeCount + exitCount)) * 100).toFixed(1)}%`
        : "0.0%";
    const cards: DashboardCard[] = [
      {
        key: "employees",
        label: useUserMetrics
          ? "Total Users"
          : canSeeOrgMetrics
            ? "Total Employees"
            : "Team Members",
        value: String(totalPeopleCount),
        detail: `${activePeopleCount} active ${useUserMetrics ? "users" : "records"}`,
        tone: "brand"
      },
      {
        key: "present_today",
        label: "Present Today",
        value: String(presentTodayCount),
        detail: "Marked attendance today",
        tone: "blue"
      },
      {
        key: "on_leave",
        label: "On Leave",
        value: String(employeesOnLeaveCount),
        detail: "Approved leave today",
        tone: "amber"
      },
      {
        key: "pending_leaves",
        label: "Pending Leave",
        value: String(pendingLeaveCount),
        detail: "Awaiting review",
        tone: "slate"
      },
      {
        key: "new_hires",
        label: useUserMetrics ? "New Users" : "New Hires",
        value: String(monthlyJoinCount),
        detail: useUserMetrics ? "Created this month" : "Joined this month",
        tone: "blue"
      },
      {
        key: "attrition_rate",
        label: "Attrition Rate",
        value: attritionRate,
        detail: "Current calendar year",
        tone: "amber"
      },
      {
        key: "unread_notifications",
        label: "Unread Alerts",
        value: String(unreadNotifications),
        detail: "In-app notifications",
        tone: "slate"
      }
    ];

    const summary: DashboardSummaryPayload = {
      cards,
      notifications,
      scope: canSeeOrgMetrics ? "organization" : "self_or_team"
    };

    await writeDashboardCache({
      cacheKey,
      summary,
      ttlSeconds: env.DASHBOARD_CACHE_TTL_SECONDS
    });

    res.status(200).json(
      ok(summary, {
        cache: shouldBypassCache ? "refresh" : "miss",
        ...(failedSections.length > 0 ? { partial: true, failedSections } : {})
      })
    );
  })
);
