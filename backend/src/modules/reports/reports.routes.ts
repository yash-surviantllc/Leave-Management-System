import type { Request } from "express";
import { Router } from "express";
import { AttendanceStatus, EmploymentStatus, LeaveRequestStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/authenticate";
import { requireAnyPermission, requirePermissions } from "../../middleware/authorize";
import { AppError } from "../../middleware/error-handler";
import { ok } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  getMonthDateRange,
  toDateOnlyFromInput
} from "../../utils/date";
import { materializeMissingAbsences } from "../attendance/attendance-completion";

export const reportsRouter = Router();

const employeeSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  workEmail: true,
  status: true,
  dateOfJoining: true,
  dateOfExit: true,
  department: true,
  designation: true
} satisfies Prisma.EmployeeSelect;

const uuidSchema = z.string().uuid();
const dateInputSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const employeeReportQuerySchema = z.object({
  status: z.nativeEnum(EmploymentStatus).optional(),
  departmentId: uuidSchema.optional(),
  dateFrom: dateInputSchema.optional(),
  dateTo: dateInputSchema.optional()
});

const attendanceReportQuerySchema = z.object({
  dateFrom: dateInputSchema.optional(),
  dateTo: dateInputSchema.optional(),
  employeeId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
  status: z.nativeEnum(AttendanceStatus).optional()
});

const leaveReportQuerySchema = z.object({
  dateFrom: dateInputSchema.optional(),
  dateTo: dateInputSchema.optional(),
  status: z.nativeEnum(LeaveRequestStatus).optional(),
  employeeId: uuidSchema.optional(),
  departmentId: uuidSchema.optional()
});


function parseInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Request input is invalid", result.error.flatten());
  }

  return result.data;
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

function getDefaultDateRange(): { dateFrom: Date; dateTo: Date } {
  return getMonthDateRange(new Date());
}

async function getTeamEmployeeWhere(req: Request): Promise<Prisma.EmployeeWhereInput> {
  if (hasPermission(req, "employees:manage") || hasPermission(req, "reports:read")) {
    return {};
  }

  const employee = await prisma.employee.findUnique({
    where: {
      userId: assertAuthenticated(req).id
    }
  });

  if (!employee) {
    throw new AppError(400, "EMPLOYEE_PROFILE_REQUIRED", "This account is not linked to an employee record");
  }

  return {
    managerId: employee.id
  };
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (summary, value) => ({
      ...summary,
      [value]: (summary[value] ?? 0) + 1
    }),
    {} as Record<T, number>
  );
}

reportsRouter.use(authenticate);

reportsRouter.get(
  "/reports/employees",
  requirePermissions(["reports:read"]),
  asyncHandler(async (req, res) => {
    const query = parseInput(employeeReportQuerySchema, req.query);
    const where: Prisma.EmployeeWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.dateFrom || query.dateTo) {
      where.dateOfJoining = {
        ...(query.dateFrom ? { gte: toDateOnlyFromInput(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: toDateOnlyFromInput(query.dateTo) } : {})
      };
    }

    const employees = await prisma.employee.findMany({
      where,
      select: employeeSelect,
      orderBy: {
        employeeCode: "asc"
      }
    });
    const statusSummary = countBy(employees.map((employee) => employee.status));
    const departmentSummary = employees.reduce<Record<string, number>>((summary, employee) => {
      const key = employee.department?.name ?? "Unassigned";

      return {
        ...summary,
        [key]: (summary[key] ?? 0) + 1
      };
    }, {});

    res.status(200).json(
      ok({
        employees,
        summary: {
          total: employees.length,
          byStatus: statusSummary,
          byDepartment: departmentSummary
        }
      })
    );
  })
);

reportsRouter.get(
  "/reports/attendance",
  requireAnyPermission(["reports:read", "attendance:read"]),
  asyncHandler(async (req, res) => {
    const query = parseInput(attendanceReportQuerySchema, req.query);
    const defaultRange = getDefaultDateRange();
    const employeeWhere = await getTeamEmployeeWhere(req);
    const dateFrom = query.dateFrom ? toDateOnlyFromInput(query.dateFrom) : defaultRange.dateFrom;
    const dateTo = query.dateTo ? toDateOnlyFromInput(query.dateTo) : defaultRange.dateTo;
    const where: Prisma.AttendanceWhereInput = {
      date: {
        gte: dateFrom,
        lte: dateTo
      },
      employee: employeeWhere
    };

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.departmentId) {
      where.employee = {
        ...employeeWhere,
        departmentId: query.departmentId
      };
    }

    await materializeMissingAbsences({
      dateFrom,
      dateTo,
      employeeId: query.employeeId,
      employeeWhere: where.employee
    });

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: employeeSelect
        },
        shift: true
      },
      orderBy: [
        {
          date: "desc"
        },
        {
          createdAt: "desc"
        }
      ]
    });

    res.status(200).json(
      ok({
        attendance,
        summary: {
          total: attendance.length,
          byStatus: countBy(attendance.map((record) => record.status))
        }
      })
    );
  })
);

reportsRouter.get(
  "/reports/leaves",
  requireAnyPermission(["reports:read", "leave:approve"]),
  asyncHandler(async (req, res) => {
    const query = parseInput(leaveReportQuerySchema, req.query);
    const defaultRange = getDefaultDateRange();
    const employeeWhere = await getTeamEmployeeWhere(req);
    const where: Prisma.LeaveRequestWhereInput = {
      startDate: {
        lte: query.dateTo ? toDateOnlyFromInput(query.dateTo) : defaultRange.dateTo
      },
      endDate: {
        gte: query.dateFrom ? toDateOnlyFromInput(query.dateFrom) : defaultRange.dateFrom
      },
      employee: employeeWhere
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.departmentId) {
      where.employee = {
        ...employeeWhere,
        departmentId: query.departmentId
      };
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: employeeSelect
        },
        leaveType: true,
        reviewer: {
          select: employeeSelect
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    const byType = leaveRequests.reduce<Record<string, number>>((summary, leaveRequest) => {
      const key = leaveRequest.leaveType.name;

      return {
        ...summary,
        [key]: (summary[key] ?? 0) + 1
      };
    }, {});

    res.status(200).json(
      ok({
        leaveRequests,
        summary: {
          total: leaveRequests.length,
          byStatus: countBy(leaveRequests.map((leaveRequest) => leaveRequest.status)),
          byType
        }
      })
    );
  })
);

