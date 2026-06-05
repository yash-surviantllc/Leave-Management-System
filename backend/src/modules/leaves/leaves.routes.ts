import type { Request } from "express";
import { Router } from "express";
import { LeaveDayType, LeaveRequestStatus, Prisma, type Notification } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { emitNotificationCreated } from "../../lib/realtime";
import { authenticate } from "../../middleware/authenticate";
import { requireAnyPermission, requirePermissions } from "../../middleware/authorize";
import { AppError } from "../../middleware/error-handler";
import { ok } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  getPagination,
  getPaginationMeta,
  paginationQuerySchema
} from "../../utils/pagination";

export const leaveRouter = Router();

const leaveRequestInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true,
      userId: true,
      department: true,
      designation: true
    }
  },
  leaveType: true,
  reviewer: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true
    }
  }
} satisfies Prisma.LeaveRequestInclude;

const balanceInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true,
      department: true
    }
  },
  leaveType: true
} satisfies Prisma.LeaveBalanceInclude;

const uuidSchema = z.string().uuid();
const dateInputSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);

const nullableStringSchema = (maxLength: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value): string | null => {
      if (typeof value !== "string") {
        return null;
      }

      const trimmedValue = value.trim();

      return trimmedValue.length > 0 ? trimmedValue : null;
    })
    .pipe(z.string().max(maxLength).nullable());

const createLeaveSchema = z.object({
  leaveTypeId: uuidSchema,
  startDate: dateInputSchema,
  endDate: dateInputSchema,
  dayType: z.nativeEnum(LeaveDayType),
  reason: z.string().trim().min(3).max(600)
});

const leaveDecisionSchema = z.object({
  decisionNote: nullableStringSchema(400)
});

const leaveListQuerySchema = z.object({
  status: z.nativeEnum(LeaveRequestStatus).optional(),
  employeeId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
  dateFrom: dateInputSchema.optional(),
  dateTo: dateInputSchema.optional()
}).merge(paginationQuerySchema);

const leaveBalanceQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  employeeId: uuidSchema.optional()
}).merge(paginationQuerySchema);

const leaveTypeBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: nullableStringSchema(300),
  defaultAnnualAllowance: z.number().min(0).max(365),
  isPaid: z.boolean(),
  requiresApproval: z.boolean(),
  isActive: z.boolean()
});

const paramsSchema = z.object({
  id: uuidSchema
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
  const auth = assertAuthenticated(req);

  return auth.permissions.includes(permission);
}

function toDateOnlyFromInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function getDateYear(date: Date): number {
  return date.getUTCFullYear();
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

async function getEmployeeForAuth(req: Request) {
  const auth = assertAuthenticated(req);
  const employee = await prisma.employee.findUnique({
    where: {
      userId: auth.id
    }
  });

  if (!employee) {
    throw new AppError(400, "EMPLOYEE_PROFILE_REQUIRED", "This account is not linked to an employee record");
  }

  return employee;
}

async function calculateLeaveDays(input: {
  startDate: Date;
  endDate: Date;
  dayType: LeaveDayType;
}): Promise<number> {
  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: input.startDate,
        lte: input.endDate
      }
    },
    select: {
      date: true
    }
  });
  const holidayKeys = new Set(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)));
  let leaveDays = 0;

  for (
    let cursor = input.startDate;
    cursor.getTime() <= input.endDate.getTime();
    cursor = addDays(cursor, 1)
  ) {
    const day = cursor.getUTCDay();
    const key = cursor.toISOString().slice(0, 10);

    if (day === 0 || day === 6 || holidayKeys.has(key)) {
      continue;
    }

    leaveDays += 1;
  }

  if (input.dayType === "HALF_DAY") {
    return leaveDays * 0.5;
  }

  return leaveDays;
}

function calculateAvailableBalance(balance: {
  openingBalance: number;
  accrued: number;
  used: number;
  pending: number;
}): number {
  return balance.openingBalance + balance.accrued - balance.used - balance.pending;
}

async function getOrCreateLeaveBalance(input: {
  transaction: Prisma.TransactionClient;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  openingBalance: number;
}) {
  return input.transaction.leaveBalance.upsert({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        year: input.year
      }
    },
    update: {},
    create: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year,
      openingBalance: input.openingBalance,
      available: input.openingBalance
    }
  });
}

async function createNotificationsForPermission(input: {
  transaction: Prisma.TransactionClient;
  permission: string;
  title: string;
  message: string;
  category: string;
}): Promise<Notification[]> {
  const users = await input.transaction.user.findMany({
    where: {
      status: "ACTIVE",
      roles: {
        some: {
          role: {
            permissions: {
              some: {
                permission: {
                  key: input.permission
                }
              }
            }
          }
        }
      }
    },
    select: {
      id: true
    }
  });

  if (users.length === 0) {
    return [];
  }

  return Promise.all(
    users.map((user) =>
      input.transaction.notification.create({
        data: {
          userId: user.id,
          title: input.title,
          message: input.message,
          category: input.category
        }
      })
    )
  );
}

async function createNotificationForUser(input: {
  transaction: Prisma.TransactionClient;
  userId: string | null;
  title: string;
  message: string;
  category: string;
}): Promise<Notification | null> {
  if (!input.userId) {
    return null;
  }

  return input.transaction.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      category: input.category
    }
  });
}

function handlePrismaMutationError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError(409, "DUPLICATE_RECORD", "A record with the same unique value already exists");
    }

    if (error.code === "P2003") {
      throw new AppError(400, "INVALID_REFERENCE", "One of the selected related records does not exist");
    }

    if (error.code === "P2025") {
      throw new AppError(404, "RECORD_NOT_FOUND", "The requested record was not found");
    }
  }

  throw error;
}

leaveRouter.use(authenticate);

leaveRouter.get(
  "/leave-types",
  requireAnyPermission(["leave:request", "leave:approve", "leave:manage"]),
  asyncHandler(async (_req, res) => {
    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: [
        {
          isActive: "desc"
        },
        {
          name: "asc"
        }
      ]
    });

    res.status(200).json(ok({ leaveTypes }, { total: leaveTypes.length }));
  })
);

leaveRouter.post(
  "/leave-types",
  requirePermissions(["leave:manage"]),
  asyncHandler(async (req, res) => {
    const body = parseInput(leaveTypeBodySchema, req.body);

    try {
      const leaveType = await prisma.leaveType.create({
        data: body
      });

      res.status(201).json(ok({ leaveType }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);

leaveRouter.post(
  "/leaves",
  requirePermissions(["leave:request"]),
  asyncHandler(async (req, res) => {
    const body = parseInput(createLeaveSchema, req.body);
    const employee = await getEmployeeForAuth(req);
    const leaveType = await prisma.leaveType.findUnique({
      where: {
        id: body.leaveTypeId
      }
    });

    if (!leaveType?.isActive) {
      throw new AppError(400, "LEAVE_TYPE_UNAVAILABLE", "Selected leave type is not active");
    }

    const startDate = toDateOnlyFromInput(body.startDate);
    const endDate = toDateOnlyFromInput(body.endDate);

    if (endDate.getTime() < startDate.getTime()) {
      throw new AppError(400, "INVALID_LEAVE_RANGE", "End date cannot be before start date");
    }

    if (body.dayType === "HALF_DAY" && startDate.getTime() !== endDate.getTime()) {
      throw new AppError(400, "INVALID_HALF_DAY_RANGE", "Half-day leave must use the same start and end date");
    }

    if (getDateYear(startDate) !== getDateYear(endDate)) {
      throw new AppError(400, "INVALID_LEAVE_YEAR", "Leave requests must stay within one calendar year");
    }

    const totalDays = await calculateLeaveDays({
      startDate,
      endDate,
      dayType: body.dayType
    });

    if (totalDays <= 0) {
      throw new AppError(400, "NO_WORKING_DAYS", "Leave range does not include working days");
    }

    try {
      const transactionResult = await prisma.$transaction(async (transaction) => {
        const balance = await getOrCreateLeaveBalance({
          transaction,
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          year: getDateYear(startDate),
          openingBalance: leaveType.defaultAnnualAllowance
        });
        const requestIsApproved = !leaveType.requiresApproval;
        const nextPending = requestIsApproved ? balance.pending : balance.pending + totalDays;
        const nextUsed = requestIsApproved ? balance.used + totalDays : balance.used;
        const nextAvailable = calculateAvailableBalance({
          ...balance,
          pending: nextPending,
          used: nextUsed
        });

        if (leaveType.isPaid && nextAvailable < 0) {
          throw new AppError(400, "INSUFFICIENT_LEAVE_BALANCE", "Leave balance is insufficient");
        }

        await transaction.leaveBalance.update({
          where: {
            id: balance.id
          },
          data: {
            pending: nextPending,
            used: nextUsed,
            available: nextAvailable
          }
        });

        const createdLeaveRequest = await transaction.leaveRequest.create({
          data: {
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            startDate,
            endDate,
            dayType: body.dayType,
            totalDays,
            reason: body.reason,
            status: requestIsApproved ? "APPROVED" : "PENDING"
          },
          include: leaveRequestInclude
        });

        const notifications: Notification[] = [];

        if (requestIsApproved) {
          const notification = await createNotificationForUser({
            transaction,
            userId: createdLeaveRequest.employee.userId,
            title: "Leave approved",
            message: "Your leave request was approved automatically",
            category: "leave"
          });

          if (notification) {
            notifications.push(notification);
          }
        } else {
          const permissionNotifications = await createNotificationsForPermission({
            transaction,
            permission: "leave:approve",
            title: "Leave request pending",
            message: `${employee.firstName} ${employee.lastName} requested ${totalDays} day(s) of leave`,
            category: "leave"
          });

          notifications.push(...permissionNotifications);
        }

        return {
          leaveRequest: createdLeaveRequest,
          notifications
        };
      });

      await Promise.all(transactionResult.notifications.map(emitNotificationCreated));
      res.status(201).json(ok({ leaveRequest: transactionResult.leaveRequest }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);

leaveRouter.get(
  "/leaves/me",
  requirePermissions(["leave:request"]),
  asyncHandler(async (req, res) => {
    const query = parseInput(paginationQuerySchema, req.query);
    const pagination = getPagination(query);
    const employee = await getEmployeeForAuth(req);
    const where: Prisma.LeaveRequestWhereInput = {
      employeeId: employee.id
    };
    const [total, leaveRequests] = await prisma.$transaction([
      prisma.leaveRequest.count({
        where
      }),
      prisma.leaveRequest.findMany({
        where,
        include: leaveRequestInclude,
        orderBy: {
          createdAt: "desc"
        },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    res.status(200).json(ok({ leaveRequests }, getPaginationMeta({ total, pagination })));
  })
);

leaveRouter.get(
  "/leaves/balance",
  requireAnyPermission(["leave:request", "leave:approve", "leave:manage"]),
  asyncHandler(async (req, res) => {
    const query = parseInput(leaveBalanceQuerySchema, req.query);
    const year = query.year ?? new Date().getFullYear();
    const canViewAll = hasPermission(req, "leave:approve") || hasPermission(req, "leave:manage");
    const ownEmployee = await prisma.employee.findUnique({
      where: {
        userId: assertAuthenticated(req).id
      }
    });

    if (!canViewAll && !ownEmployee) {
      throw new AppError(400, "EMPLOYEE_PROFILE_REQUIRED", "This account is not linked to an employee record");
    }

    const employeeId = canViewAll ? query.employeeId : ownEmployee?.id;
    const pagination = getPagination(query);
    const where: Prisma.LeaveBalanceWhereInput = {
      year,
      ...(employeeId ? { employeeId } : {})
    };
    const [total, leaveBalances] = await prisma.$transaction([
      prisma.leaveBalance.count({
        where
      }),
      prisma.leaveBalance.findMany({
        where,
        include: balanceInclude,
        orderBy: [
          {
            employee: {
              employeeCode: "asc"
            }
          },
          {
            leaveType: {
              name: "asc"
            }
          }
        ],
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    res.status(200).json(ok({ leaveBalances }, getPaginationMeta({ total, pagination })));
  })
);

leaveRouter.get(
  "/leaves",
  requirePermissions(["leave:approve"]),
  asyncHandler(async (req, res) => {
    const query = parseInput(leaveListQuerySchema, req.query);
    const auth = assertAuthenticated(req);
    const where: Prisma.LeaveRequestWhereInput = {};
    const employeeWhere: Prisma.EmployeeWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.departmentId) {
      employeeWhere.departmentId = query.departmentId;
    }

    if (!auth.permissions.includes("employees:manage") && !auth.permissions.includes("leave:manage")) {
      const manager = await prisma.employee.findUnique({
        where: {
          userId: auth.id
        }
      });

      if (!manager) {
        throw new AppError(400, "EMPLOYEE_PROFILE_REQUIRED", "This account is not linked to an employee record");
      }

      employeeWhere.managerId = manager.id;
    }

    if (Object.keys(employeeWhere).length > 0) {
      where.employee = employeeWhere;
    }

    if (query.dateFrom || query.dateTo) {
      where.AND = [
        ...(query.dateTo
          ? [
              {
                startDate: {
                  lte: toDateOnlyFromInput(query.dateTo)
                }
              }
            ]
          : []),
        ...(query.dateFrom
          ? [
              {
                endDate: {
                  gte: toDateOnlyFromInput(query.dateFrom)
                }
              }
            ]
          : [])
      ];
    }

    const pagination = getPagination(query);
    const [total, leaveRequests] = await prisma.$transaction([
      prisma.leaveRequest.count({
        where
      }),
      prisma.leaveRequest.findMany({
        where,
        include: leaveRequestInclude,
        orderBy: {
          createdAt: "desc"
        },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    res.status(200).json(ok({ leaveRequests }, getPaginationMeta({ total, pagination })));
  })
);

leaveRouter.put(
  "/leaves/:id/approve",
  requirePermissions(["leave:approve"]),
  asyncHandler(async (req, res) => {
    const params = parseInput(paramsSchema, req.params);
    const body = parseInput(leaveDecisionSchema, req.body);

    try {
      const transactionResult = await prisma.$transaction(async (transaction) => {
        const existingLeaveRequest = await transaction.leaveRequest.findUnique({
          where: {
            id: params.id
          },
          include: leaveRequestInclude
        });

        if (!existingLeaveRequest) {
          throw new AppError(404, "LEAVE_NOT_FOUND", "Leave request was not found");
        }

        if (existingLeaveRequest.status !== "PENDING") {
          throw new AppError(409, "LEAVE_ALREADY_REVIEWED", "Leave request has already been reviewed");
        }

        const reviewer = await transaction.employee.findUnique({
          where: {
            userId: assertAuthenticated(req).id
          }
        });
        const balance = await transaction.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: existingLeaveRequest.employeeId,
              leaveTypeId: existingLeaveRequest.leaveTypeId,
              year: getDateYear(existingLeaveRequest.startDate)
            }
          }
        });

        if (balance) {
          const nextPending = Math.max(0, balance.pending - existingLeaveRequest.totalDays);
          const nextUsed = balance.used + existingLeaveRequest.totalDays;
          const nextAvailable = calculateAvailableBalance({
            ...balance,
            pending: nextPending,
            used: nextUsed
          });

          await transaction.leaveBalance.update({
            where: {
              id: balance.id
            },
            data: {
              pending: nextPending,
              used: nextUsed,
              available: nextAvailable
            }
          });
        }

        const updatedLeaveRequest = await transaction.leaveRequest.update({
          where: {
            id: existingLeaveRequest.id
          },
          data: {
            status: "APPROVED",
            reviewerId: reviewer?.id ?? null,
            reviewedAt: new Date(),
            decisionNote: body.decisionNote
          },
          include: leaveRequestInclude
        });

        const notification = await createNotificationForUser({
          transaction,
          userId: existingLeaveRequest.employee.userId,
          title: "Leave approved",
          message: "Your leave request has been approved",
          category: "leave"
        });

        return {
          leaveRequest: updatedLeaveRequest,
          notifications: notification ? [notification] : []
        };
      });

      await Promise.all(transactionResult.notifications.map(emitNotificationCreated));
      res.status(200).json(ok({ leaveRequest: transactionResult.leaveRequest }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);

leaveRouter.put(
  "/leaves/:id/reject",
  requirePermissions(["leave:approve"]),
  asyncHandler(async (req, res) => {
    const params = parseInput(paramsSchema, req.params);
    const body = parseInput(leaveDecisionSchema, req.body);

    try {
      const transactionResult = await prisma.$transaction(async (transaction) => {
        const existingLeaveRequest = await transaction.leaveRequest.findUnique({
          where: {
            id: params.id
          },
          include: leaveRequestInclude
        });

        if (!existingLeaveRequest) {
          throw new AppError(404, "LEAVE_NOT_FOUND", "Leave request was not found");
        }

        if (existingLeaveRequest.status !== "PENDING") {
          throw new AppError(409, "LEAVE_ALREADY_REVIEWED", "Leave request has already been reviewed");
        }

        const reviewer = await transaction.employee.findUnique({
          where: {
            userId: assertAuthenticated(req).id
          }
        });
        const balance = await transaction.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: existingLeaveRequest.employeeId,
              leaveTypeId: existingLeaveRequest.leaveTypeId,
              year: getDateYear(existingLeaveRequest.startDate)
            }
          }
        });

        if (balance) {
          const nextPending = Math.max(0, balance.pending - existingLeaveRequest.totalDays);
          const nextAvailable = calculateAvailableBalance({
            ...balance,
            pending: nextPending
          });

          await transaction.leaveBalance.update({
            where: {
              id: balance.id
            },
            data: {
              pending: nextPending,
              available: nextAvailable
            }
          });
        }

        const updatedLeaveRequest = await transaction.leaveRequest.update({
          where: {
            id: existingLeaveRequest.id
          },
          data: {
            status: "REJECTED",
            reviewerId: reviewer?.id ?? null,
            reviewedAt: new Date(),
            decisionNote: body.decisionNote
          },
          include: leaveRequestInclude
        });

        const notification = await createNotificationForUser({
          transaction,
          userId: existingLeaveRequest.employee.userId,
          title: "Leave rejected",
          message: "Your leave request has been rejected",
          category: "leave"
        });

        return {
          leaveRequest: updatedLeaveRequest,
          notifications: notification ? [notification] : []
        };
      });

      await Promise.all(transactionResult.notifications.map(emitNotificationCreated));
      res.status(200).json(ok({ leaveRequest: transactionResult.leaveRequest }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);
