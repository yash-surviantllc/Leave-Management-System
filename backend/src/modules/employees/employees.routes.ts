import type { Request } from "express";
import { Router } from "express";
import { EmploymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
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
import {
  getCurrentLeaveBalanceYear,
  initializeLeaveBalancesForEmployee
} from "./onboarding";

export const employeeCoreRouter = Router();

const employeeInclude = {
  department: true,
  designation: {
    include: {
      department: true
    }
  },
  manager: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true,
      status: true
    }
  },
  emergencyContacts: {
    orderBy: [
      {
        isPrimary: "desc" as const
      },
      {
        createdAt: "asc" as const
      }
    ]
  },
} satisfies Prisma.EmployeeInclude;

const employeeListSelect = {
  id: true,
  employeeCode: true,
  userId: true,
  firstName: true,
  lastName: true,
  workEmail: true,
  personalEmail: true,
  phone: true,
  dateOfBirth: true,
  dateOfJoining: true,
  dateOfExit: true,
  status: true,
  location: true,
  departmentId: true,
  designationId: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  department: true,
  designation: {
    include: {
      department: true
    }
  },
  manager: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workEmail: true,
      status: true
    }
  },
} satisfies Prisma.EmployeeSelect;

type EmployeeRecord = Prisma.EmployeeGetPayload<{
  include: typeof employeeInclude;
}>;

const nullableStringSchema = (maxLength: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value): string | null => {
      if (typeof value !== "string") {
        return null;
      }

      const trimmedValue = value.trim();

      if (!trimmedValue) {
        return null;
      }

      return trimmedValue;
    })
    .pipe(z.string().max(maxLength).nullable());

const nullableEmailSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value): string | null => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmedValue = value.trim().toLowerCase();

    if (!trimmedValue) {
      return null;
    }

    return trimmedValue;
  })
  .pipe(z.string().email().nullable());

const emailSchema = z
  .string()
  .trim()
  .email("Email must be valid")
  .transform((email) => email.toLowerCase());

const requiredDateSchema = z.string().trim().min(1).transform((value, context) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Date must be valid"
    });
    return z.NEVER;
  }

  return date;
});

const nullableDateSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, context): Date | null => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return null;
    }

    const date = new Date(value.trim());

    if (Number.isNaN(date.getTime())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date must be valid"
      });
      return z.NEVER;
    }

    return date;
  });

const uuidSchema = z.string().uuid();
const nullableUuidSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value): string | null => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return null;
    }

    return trimmedValue;
  })
  .pipe(uuidSchema.nullable());

const paramsSchema = z.object({
  id: uuidSchema
});

const listEmployeesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(EmploymentStatus).optional(),
  departmentId: uuidSchema.optional(),
  designationId: uuidSchema.optional()
}).merge(paginationQuerySchema);

const emergencyContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(30),
  email: nullableEmailSchema,
  isPrimary: z.boolean().optional()
});

const employeeBodySchema = z.object({
  employeeCode: z.string().trim().min(2).max(40),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(1).max(80),
  workEmail: emailSchema,
  personalEmail: nullableEmailSchema,
  phone: nullableStringSchema(30),
  dateOfBirth: nullableDateSchema,
  dateOfJoining: requiredDateSchema,
  dateOfExit: nullableDateSchema,
  status: z.nativeEnum(EmploymentStatus),
  location: nullableStringSchema(120),
  departmentId: nullableUuidSchema,
  designationId: nullableUuidSchema,
  managerId: nullableUuidSchema,
  emergencyContacts: z.array(emergencyContactSchema).max(3)
});

const employeeUpdateBodySchema = employeeBodySchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  "At least one field is required"
);

const departmentBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: nullableStringSchema(300)
});

const designationBodySchema = z.object({
  title: z.string().trim().min(2).max(100),
  description: nullableStringSchema(300),
  departmentId: nullableUuidSchema
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

function canManageEmployees(req: Request): boolean {
  const auth = assertAuthenticated(req);

  return auth.permissions.includes("employees:manage");
}

function assertCanReadEmployee(req: Request, employee: EmployeeRecord): void {
  const auth = assertAuthenticated(req);

  if (canManageEmployees(req) || employee.userId === auth.id) {
    return;
  }

  throw new AppError(403, "PERMISSION_DENIED", "This account cannot access this employee record");
}

async function findEmployeeOrThrow(id: string): Promise<EmployeeRecord> {
  const employee = await prisma.employee.findUnique({
    where: {
      id
    },
    include: employeeInclude
  });

  if (!employee) {
    throw new AppError(404, "EMPLOYEE_NOT_FOUND", "Employee record was not found");
  }

  return employee;
}

async function findLinkableUserId(workEmail: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: {
      email: workEmail
    },
    include: {
      employee: {
        select: {
          id: true
        }
      }
    }
  });

  if (!user) {
    return null;
  }

  if (user.employee) {
    throw new AppError(409, "USER_ALREADY_LINKED", "This user account is already linked to an employee");
  }

  return user.id;
}

function toEmergencyContactCreateMany(
  employeeId: string,
  contacts: z.infer<typeof emergencyContactSchema>[]
): Prisma.EmergencyContactCreateManyInput[] {
  return contacts.map((contact) => ({
    employeeId,
    name: contact.name,
    relationship: contact.relationship,
    phone: contact.phone,
    email: contact.email,
    isPrimary: contact.isPrimary ?? false
  }));
}

function buildEmployeeCreateData(
  body: z.infer<typeof employeeBodySchema>,
  userId: string | null
): Prisma.EmployeeUncheckedCreateInput {
  return {
    employeeCode: body.employeeCode,
    userId,
    firstName: body.firstName,
    lastName: body.lastName,
    workEmail: body.workEmail,
    personalEmail: body.personalEmail,
    phone: body.phone,
    dateOfBirth: body.dateOfBirth,
    dateOfJoining: body.dateOfJoining,
    dateOfExit: body.dateOfExit,
    status: body.status,
    location: body.location,
    departmentId: body.departmentId,
    designationId: body.designationId,
    managerId: body.managerId
  };
}

function buildEmployeeUpdateData(
  body: z.infer<typeof employeeUpdateBodySchema>
): Prisma.EmployeeUncheckedUpdateInput {
  const data: Prisma.EmployeeUncheckedUpdateInput = {};

  if (body.employeeCode !== undefined) {
    data.employeeCode = body.employeeCode;
  }

  if (body.firstName !== undefined) {
    data.firstName = body.firstName;
  }

  if (body.lastName !== undefined) {
    data.lastName = body.lastName;
  }

  if (body.workEmail !== undefined) {
    data.workEmail = body.workEmail;
  }

  if (body.personalEmail !== undefined) {
    data.personalEmail = body.personalEmail;
  }

  if (body.phone !== undefined) {
    data.phone = body.phone;
  }

  if (body.dateOfBirth !== undefined) {
    data.dateOfBirth = body.dateOfBirth;
  }

  if (body.dateOfJoining !== undefined) {
    data.dateOfJoining = body.dateOfJoining;
  }

  if (body.dateOfExit !== undefined) {
    data.dateOfExit = body.dateOfExit;
  }

  if (body.status !== undefined) {
    data.status = body.status;
  }

  if (body.location !== undefined) {
    data.location = body.location;
  }

  if (body.departmentId !== undefined) {
    data.departmentId = body.departmentId;
  }

  if (body.designationId !== undefined) {
    data.designationId = body.designationId;
  }

  if (body.managerId !== undefined) {
    data.managerId = body.managerId;
  }

  return data;
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

employeeCoreRouter.use(authenticate);

employeeCoreRouter.get(
  "/employees/me",
  asyncHandler(async (req, res) => {
    const auth = assertAuthenticated(req);
    const employee = await prisma.employee.findUnique({
      where: {
        userId: auth.id
      },
      include: employeeInclude
    });

    res.status(200).json(ok({ employee }));
  })
);

employeeCoreRouter.get(
  "/employees",
  requirePermissions(["employees:manage"]),
  asyncHandler(async (req, res) => {
    const query = parseInput(listEmployeesQuerySchema, req.query);
    const where: Prisma.EmployeeWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.designationId) {
      where.designationId = query.designationId;
    }

    if (query.search) {
      where.OR = [
        {
          employeeCode: {
            contains: query.search,
            mode: "insensitive"
          }
        },
        {
          firstName: {
            contains: query.search,
            mode: "insensitive"
          }
        },
        {
          lastName: {
            contains: query.search,
            mode: "insensitive"
          }
        },
        {
          workEmail: {
            contains: query.search,
            mode: "insensitive"
          }
        }
      ];
    }

    const pagination = getPagination(query);
    const [total, employees] = await prisma.$transaction([
      prisma.employee.count({
        where
      }),
      prisma.employee.findMany({
        where,
        select: employeeListSelect,
        orderBy: [
          {
            createdAt: "desc"
          },
          {
            employeeCode: "asc"
          }
        ],
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    res.status(200).json(ok({ employees }, getPaginationMeta({ total, pagination })));
  })
);

employeeCoreRouter.post(
  "/employees",
  requirePermissions(["employees:manage"]),
  asyncHandler(async (req, res) => {
    const body = parseInput(employeeBodySchema, req.body);

    try {
      const userId = await findLinkableUserId(body.workEmail);
      const employee = await prisma.$transaction(async (transaction) => {
        const createdEmployee = await transaction.employee.create({
          data: buildEmployeeCreateData(body, userId)
        });

        await initializeLeaveBalancesForEmployee({
          transaction,
          employeeId: createdEmployee.id,
          year: getCurrentLeaveBalanceYear()
        });

        if (body.emergencyContacts.length > 0) {
          await transaction.emergencyContact.createMany({
            data: toEmergencyContactCreateMany(createdEmployee.id, body.emergencyContacts)
          });
        }

        return transaction.employee.findUniqueOrThrow({
          where: {
            id: createdEmployee.id
          },
          include: employeeInclude
        });
      });

      res.status(201).json(ok({ employee }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);

employeeCoreRouter.get(
  "/employees/:id",
  asyncHandler(async (req, res) => {
    const params = parseInput(paramsSchema, req.params);
    const employee = await findEmployeeOrThrow(params.id);
    assertCanReadEmployee(req, employee);

    res.status(200).json(ok({ employee }));
  })
);

employeeCoreRouter.put(
  "/employees/:id",
  requirePermissions(["employees:manage"]),
  asyncHandler(async (req, res) => {
    const params = parseInput(paramsSchema, req.params);
    const body = parseInput(employeeUpdateBodySchema, req.body);

    if (body.managerId === params.id) {
      throw new AppError(400, "INVALID_MANAGER", "Employee cannot be their own manager");
    }

    try {
      const employee = await prisma.$transaction(async (transaction) => {
        const data = buildEmployeeUpdateData(body);

        if (Object.keys(data).length > 0) {
          await transaction.employee.update({
            where: {
              id: params.id
            },
            data
          });
        }

        if (body.emergencyContacts !== undefined) {
          await transaction.emergencyContact.deleteMany({
            where: {
              employeeId: params.id
            }
          });

          if (body.emergencyContacts.length > 0) {
            await transaction.emergencyContact.createMany({
              data: toEmergencyContactCreateMany(params.id, body.emergencyContacts)
            });
          }
        }

        return transaction.employee.findUniqueOrThrow({
          where: {
            id: params.id
          },
          include: employeeInclude
        });
      });

      res.status(200).json(ok({ employee }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);

employeeCoreRouter.delete(
  "/employees/:id",
  requirePermissions(["employees:manage"]),
  asyncHandler(async (req, res) => {
    const params = parseInput(paramsSchema, req.params);

    try {
      const employee = await prisma.$transaction(async (transaction) => {
        const existingEmployee = await transaction.employee.findUnique({
          where: {
            id: params.id
          }
        });

        if (!existingEmployee) {
          throw new AppError(404, "EMPLOYEE_NOT_FOUND", "Employee record was not found");
        }

        const updatedEmployee = await transaction.employee.update({
          where: {
            id: params.id
          },
          data: {
            status: "INACTIVE",
            dateOfExit: existingEmployee.dateOfExit ?? new Date()
          },
          include: employeeInclude
        });

        if (existingEmployee.userId) {
          await transaction.user.update({
            where: {
              id: existingEmployee.userId
            },
            data: {
              status: "INACTIVE"
            }
          });
        }

        return updatedEmployee;
      });

      res.status(200).json(ok({ employee }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);


employeeCoreRouter.get(
  "/departments",
  requireAnyPermission(["employees:manage", "attendance:read", "leave:approve"]),
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            employees: true,
            designations: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    });

    res.status(200).json(ok({ departments }, { total: departments.length }));
  })
);

employeeCoreRouter.post(
  "/departments",
  requirePermissions(["employees:manage"]),
  asyncHandler(async (req, res) => {
    const body = parseInput(departmentBodySchema, req.body);

    try {
      const department = await prisma.department.create({
        data: {
          name: body.name,
          description: body.description
        },
        include: {
          _count: {
            select: {
              employees: true,
              designations: true
            }
          }
        }
      });

      res.status(201).json(ok({ department }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);

employeeCoreRouter.delete(
  "/departments/:id",
  requirePermissions(["employees:manage"]),
  asyncHandler(async (req, res) => {
    const params = parseInput(paramsSchema, req.params);

    try {
      const department = await prisma.department.delete({
        where: {
          id: params.id
        },
        include: {
          _count: {
            select: {
              employees: true,
              designations: true
            }
          }
        }
      });

      res.status(200).json(ok({ department }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);

employeeCoreRouter.get(
  "/designations",
  requirePermissions(["employees:manage"]),
  asyncHandler(async (_req, res) => {
    const designations = await prisma.designation.findMany({
      include: {
        department: true,
        _count: {
          select: {
            employees: true
          }
        }
      },
      orderBy: [
        {
          title: "asc"
        },
        {
          createdAt: "desc"
        }
      ]
    });

    res.status(200).json(ok({ designations }, { total: designations.length }));
  })
);

employeeCoreRouter.post(
  "/designations",
  requirePermissions(["employees:manage"]),
  asyncHandler(async (req, res) => {
    const body = parseInput(designationBodySchema, req.body);

    try {
      const designation = await prisma.designation.create({
        data: {
          title: body.title,
          description: body.description,
          departmentId: body.departmentId
        },
        include: {
          department: true,
          _count: {
            select: {
              employees: true
            }
          }
        }
      });

      res.status(201).json(ok({ designation }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);

employeeCoreRouter.delete(
  "/designations/:id",
  requirePermissions(["employees:manage"]),
  asyncHandler(async (req, res) => {
    const params = parseInput(paramsSchema, req.params);

    try {
      const designation = await prisma.designation.delete({
        where: {
          id: params.id
        },
        include: {
          department: true,
          _count: {
            select: {
              employees: true
            }
          }
        }
      });

      res.status(200).json(ok({ designation }));
    } catch (error) {
      handlePrismaMutationError(error);
    }
  })
);
