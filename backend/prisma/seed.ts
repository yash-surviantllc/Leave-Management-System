import { PrismaClient, type Role, type User } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/password";

const prisma = new PrismaClient();
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
const seedHrPassword = process.env.SEED_HR_PASSWORD ?? "Hr@12345";
const seedManagerPassword = process.env.SEED_MANAGER_PASSWORD ?? "Manager@12345";
const seedEmployeePassword = process.env.SEED_EMPLOYEE_PASSWORD ?? "Employee@12345";

const roles = [
  { name: "SUPER_ADMIN", description: "Full system access" },
  { name: "HR_ADMIN", description: "HR operations access" },
  { name: "MANAGER", description: "Team-level access" },
  { name: "EMPLOYEE", description: "Self-service access" }
];

const permissions = [
  { key: "dashboard:read", description: "View dashboard" },
  { key: "profile:read", description: "View own user profile" },
  { key: "users:manage", description: "Manage users and roles" },
  { key: "employees:manage", description: "Manage employees" },
  { key: "attendance:read", description: "View attendance" },
  { key: "attendance:write", description: "Record own attendance" },
  { key: "attendance:manage", description: "Manage shifts and holidays" },
  { key: "leave:request", description: "Request leave" },
  { key: "leave:approve", description: "Approve leave requests" },
  { key: "leave:manage", description: "Manage leave settings" },
  { key: "reports:read", description: "View HR reports" },
  { key: "notifications:read", description: "View own notifications" }
];

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map((permission) => permission.key),
  HR_ADMIN: [
    "dashboard:read",
    "profile:read",
    "employees:manage",
    "attendance:read",
    "attendance:write",
    "attendance:manage",
    "leave:request",
    "leave:approve",
    "leave:manage",
    "reports:read",
    "notifications:read"
  ],
  MANAGER: [
    "dashboard:read",
    "profile:read",
    "attendance:read",
    "attendance:write",
    "leave:request",
    "leave:approve",
    "notifications:read"
  ],
  EMPLOYEE: [
    "dashboard:read",
    "profile:read",
    "attendance:write",
    "leave:request",
    "notifications:read"
  ]
};

const departments = [
  {
    name: "People Operations",
    description: "HR operations, employee services, and compliance"
  },
  {
    name: "Engineering",
    description: "Product engineering and platform delivery"
  }
];

const designations = [
  {
    title: "HR Director",
    description: "Owns HR operations and employee lifecycle",
    departmentName: "People Operations"
  },
  {
    title: "HR Manager",
    description: "Runs employee operations and policy workflows",
    departmentName: "People Operations"
  },
  {
    title: "Engineering Manager",
    description: "Leads delivery planning and team coordination",
    departmentName: "Engineering"
  },
  {
    title: "Software Engineer",
    description: "Builds and maintains product systems",
    departmentName: "Engineering"
  }
];

const leaveTypes = [
  {
    name: "Casual Leave",
    description: "Paid casual leave for personal needs and short-term requirements",
    defaultAnnualAllowance: 12,
    isPaid: true,
    requiresApproval: true
  },
  {
    name: "Sick Leave",
    description: "Paid leave for illness and medical care",
    defaultAnnualAllowance: 8,
    isPaid: true,
    requiresApproval: true
  },
  {
    name: "Earned Leave",
    description: "Paid earned leave based on tenure and performance",
    defaultAnnualAllowance: 15,
    isPaid: true,
    requiresApproval: true
  }
];

const holidays = [
  {
    name: "New Year's Day",
    date: new Date("2026-01-01T00:00:00.000Z"),
    type: "PUBLIC" as const,
    description: "Public holiday"
  },
  {
    name: "Company Foundation Day",
    date: new Date("2026-05-18T00:00:00.000Z"),
    type: "COMPANY" as const,
    description: "Company holiday"
  }
];

function getRequiredRole(createdRoles: Role[], roleName: string): Role {
  const role = createdRoles.find((createdRole) => createdRole.name === roleName);

  if (!role) {
    throw new Error(`Missing seed role: ${roleName}`);
  }

  return role;
}

async function assignExclusiveRole(
  userId: string,
  role: Role,
  createdRoles: Role[]
): Promise<void> {
  await Promise.all(
    createdRoles
      .filter((createdRole) => createdRole.id !== role.id)
      .map((createdRole) =>
        prisma.userRole.deleteMany({
          where: {
            userId,
            roleId: createdRole.id
          }
        })
      )
  );

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id
      }
    },
    update: {},
    create: {
      userId,
      roleId: role.id
    }
  });
}

async function upsertSeedUser(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
  createdRoles: Role[];
}): Promise<User> {
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.upsert({
    where: {
      email: input.email
    },
    update: {
      name: input.name,
      passwordHash,
      status: "ACTIVE"
    },
    create: {
      email: input.email,
      name: input.name,
      passwordHash,
      status: "ACTIVE"
    }
  });

  await assignExclusiveRole(user.id, input.role, input.createdRoles);

  return user;
}

async function main() {
  const createdPermissions = await Promise.all(
    permissions.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: permission,
        create: permission
      })
    )
  );

  const createdRoles = await Promise.all(
    roles.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        update: role,
        create: role
      })
    )
  );

  await Promise.all(
    createdRoles.flatMap((role) => {
      const permissionKeys = rolePermissions[role.name] ?? [];
      const permissionsForRole = createdPermissions.filter((permission) =>
        permissionKeys.includes(permission.key)
      );

      return permissionsForRole.map((permission) =>
        prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id
          }
        })
      );
    })
  );

  const superAdmin = getRequiredRole(createdRoles, "SUPER_ADMIN");
  const hrAdminRole = getRequiredRole(createdRoles, "HR_ADMIN");
  const managerRole = getRequiredRole(createdRoles, "MANAGER");
  const employeeRole = getRequiredRole(createdRoles, "EMPLOYEE");
  const user = await upsertSeedUser({
    email: "admin@surviant.in",
    name: "Elon Musk",
    password: seedAdminPassword,
    role: superAdmin,
    createdRoles
  });
  const hrUser = await upsertSeedUser({
    email: "hr@surviant.in",
    name: "Avery Stone",
    password: seedHrPassword,
    role: hrAdminRole,
    createdRoles
  });
  const managerUser = await upsertSeedUser({
    email: "manager@surviant.in",
    name: "Jordan Lee",
    password: seedManagerPassword,
    role: managerRole,
    createdRoles
  });
  const selfServiceUser = await upsertSeedUser({
    email: "employee@surviant.in",
    name: "Maya Rao",
    password: seedEmployeePassword,
    role: employeeRole,
    createdRoles
  });
  const ankitUser = await upsertSeedUser({
    email: "yash@surviant.in",
    name: "Yash Raj Jaiswal",
    password: seedEmployeePassword,
    role: employeeRole,
    createdRoles
  });

  const createdDepartments = await Promise.all(
    departments.map((department) =>
      prisma.department.upsert({
        where: {
          name: department.name
        },
        update: {
          description: department.description
        },
        create: department
      })
    )
  );

  const createdDesignations = await Promise.all(
    designations.map((designation) => {
      const department = createdDepartments.find(
        (createdDepartment) => createdDepartment.name === designation.departmentName
      );

      if (!department) {
        throw new Error(`Missing seed department: ${designation.departmentName}`);
      }

      return prisma.designation.upsert({
        where: {
          title_departmentId: {
            title: designation.title,
            departmentId: department.id
          }
        },
        update: {
          description: designation.description,
          departmentId: department.id
        },
        create: {
          title: designation.title,
          description: designation.description,
          departmentId: department.id
        }
      });
    })
  );

  const peopleOperations = createdDepartments.find(
    (department) => department.name === "People Operations"
  );
  const hrDirector = createdDesignations.find(
    (designation) => designation.title === "HR Director"
  );
  const hrManager = createdDesignations.find(
    (designation) => designation.title === "HR Manager"
  );
  const engineering = createdDepartments.find((department) => department.name === "Engineering");
  const engineeringManager = createdDesignations.find(
    (designation) => designation.title === "Engineering Manager"
  );
  const softwareEngineer = createdDesignations.find(
    (designation) => designation.title === "Software Engineer"
  );

  const employee = await prisma.employee.upsert({
    where: {
      employeeCode: "EMP-0001"
    },
    update: {
      userId: user.id,
      firstName: "Elon",
      lastName: "Musk",
      workEmail: user.email,
      departmentId: peopleOperations?.id ?? null,
      designationId: hrDirector?.id ?? null,
      status: "ACTIVE",
      location: "Head Office"
    },
    create: {
      employeeCode: "EMP-0001",
      userId: user.id,
      firstName: "Elon",
      lastName: "Musk",
      workEmail: user.email,
      dateOfJoining: new Date("2026-05-18T00:00:00.000Z"),
      departmentId: peopleOperations?.id ?? null,
      designationId: hrDirector?.id ?? null,
      status: "ACTIVE",
      location: "Head Office"
    }
  });

  const hrEmployee = await prisma.employee.upsert({
    where: {
      employeeCode: "EMP-0002"
    },
    update: {
      userId: hrUser.id,
      firstName: "Avery",
      lastName: "Stone",
      workEmail: hrUser.email,
      departmentId: peopleOperations?.id ?? null,
      designationId: hrManager?.id ?? null,
      managerId: employee.id,
      status: "ACTIVE",
      location: "Head Office"
    },
    create: {
      employeeCode: "EMP-0002",
      userId: hrUser.id,
      firstName: "Avery",
      lastName: "Stone",
      workEmail: hrUser.email,
      dateOfJoining: new Date("2026-05-19T00:00:00.000Z"),
      departmentId: peopleOperations?.id ?? null,
      designationId: hrManager?.id ?? null,
      managerId: employee.id,
      status: "ACTIVE",
      location: "Head Office"
    }
  });

  const managerEmployee = await prisma.employee.upsert({
    where: {
      employeeCode: "EMP-0004"
    },
    update: {
      userId: managerUser.id,
      firstName: "Jordan",
      lastName: "Lee",
      workEmail: managerUser.email,
      departmentId: engineering?.id ?? null,
      designationId: engineeringManager?.id ?? null,
      managerId: hrEmployee.id,
      status: "ACTIVE",
      location: "Head Office"
    },
    create: {
      employeeCode: "EMP-0004",
      userId: managerUser.id,
      firstName: "Jordan",
      lastName: "Lee",
      workEmail: managerUser.email,
      dateOfJoining: new Date("2026-05-20T00:00:00.000Z"),
      departmentId: engineering?.id ?? null,
      designationId: engineeringManager?.id ?? null,
      managerId: hrEmployee.id,
      status: "ACTIVE",
      location: "Head Office"
    }
  });

  const selfServiceEmployee = await prisma.employee.upsert({
    where: {
      employeeCode: "EMP-0003"
    },
    update: {
      userId: selfServiceUser.id,
      firstName: "Maya",
      lastName: "Rao",
      workEmail: selfServiceUser.email,
      departmentId: engineering?.id ?? null,
      designationId: softwareEngineer?.id ?? null,
      managerId: managerEmployee.id,
      status: "ACTIVE",
      location: "Remote"
    },
    create: {
      employeeCode: "EMP-0003",
      userId: selfServiceUser.id,
      firstName: "Maya",
      lastName: "Rao",
      workEmail: selfServiceUser.email,
      dateOfJoining: new Date("2026-05-20T00:00:00.000Z"),
      departmentId: engineering?.id ?? null,
      designationId: softwareEngineer?.id ?? null,
      managerId: managerEmployee.id,
      status: "ACTIVE",
      location: "Remote"
    }
  });

  const ankitEmployee = await prisma.employee.upsert({
    where: {
      employeeCode: "EMP-0005"
    },
    update: {
      userId: ankitUser.id,
      firstName: "Ankit",
      lastName: "Kumar",
      workEmail: ankitUser.email,
      departmentId: engineering?.id ?? null,
      designationId: softwareEngineer?.id ?? null,
      managerId: managerEmployee.id,
      status: "ACTIVE",
      location: "Head Office"
    },
    create: {
      employeeCode: "EMP-0005",
      userId: ankitUser.id,
      firstName: "Ankit",
      lastName: "Kumar",
      workEmail: ankitUser.email,
      dateOfJoining: new Date("2026-05-21T00:00:00.000Z"),
      departmentId: engineering?.id ?? null,
      designationId: softwareEngineer?.id ?? null,
      managerId: managerEmployee.id,
      status: "ACTIVE",
      location: "Head Office"
    }
  });

  await prisma.emergencyContact.deleteMany({
    where: {
      employeeId: employee.id
    }
  });

  await prisma.emergencyContact.create({
    data: {
      employeeId: employee.id,
      name: "HR Desk",
      relationship: "Office",
      phone: "+1-555-0100",
      isPrimary: true
    }
  });


  await prisma.shift.upsert({
    where: {
      name: "General Shift"
    },
    update: {
      startTime: "09:30",
      endTime: "18:30",
      lateAfterMinutes: 15,
      halfDayAfterMinutes: 240,
      isDefault: true,
      isActive: true
    },
    create: {
      name: "General Shift",
      startTime: "09:30",
      endTime: "18:30",
      lateAfterMinutes: 15,
      halfDayAfterMinutes: 240,
      isDefault: true,
      isActive: true
    }
  });

  await Promise.all(
    holidays.map((holiday) =>
      prisma.holiday.upsert({
        where: {
          date: holiday.date
        },
        update: {
          name: holiday.name,
          type: holiday.type,
          description: holiday.description
        },
        create: holiday
      })
    )
  );

  const createdLeaveTypes = await Promise.all(
    leaveTypes.map((leaveType) =>
      prisma.leaveType.upsert({
        where: {
          name: leaveType.name
        },
        update: leaveType,
        create: leaveType
      })
    )
  );

  await Promise.all(
    [employee, hrEmployee, managerEmployee, selfServiceEmployee, ankitEmployee].flatMap(
      (seedEmployee) =>
        createdLeaveTypes.map((leaveType) =>
          prisma.leaveBalance.upsert({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: seedEmployee.id,
                leaveTypeId: leaveType.id,
                year: 2026
              }
            },
            update: {},
            create: {
              employeeId: seedEmployee.id,
              leaveTypeId: leaveType.id,
              year: 2026,
              openingBalance: leaveType.defaultAnnualAllowance,
              available: leaveType.defaultAnnualAllowance
            }
          })
        )
    )
  );

  
  await prisma.notification.upsert({
    where: {
      id: "seed-hr-workspace-ready"
    },
    update: {
      userId: hrUser.id,
      title: "HR workspace ready",
      message: "Employee management, leave approvals, and recruitment tools are enabled.",
      category: "SYSTEM",
      isRead: false
    },
    create: {
      id: "seed-hr-workspace-ready",
      userId: hrUser.id,
      title: "HR workspace ready",
      message: "Employee management, leave approvals, and recruitment tools are enabled.",
      category: "SYSTEM",
      isRead: false
    }
  });

  await prisma.notification.upsert({
    where: {
      id: "seed-manager-workspace-ready"
    },
    update: {
      userId: managerUser.id,
      title: "Manager workspace ready",
      message: "Team dashboard, leave approvals, and attendance tools are enabled.",
      category: "SYSTEM",
      isRead: false
    },
    create: {
      id: "seed-manager-workspace-ready",
      userId: managerUser.id,
      title: "Manager workspace ready",
      message: "Team dashboard, leave approvals, and attendance tools are enabled.",
      category: "SYSTEM",
      isRead: false
    }
  });

  await prisma.notification.upsert({
    where: {
      id: "seed-employee-self-service-ready"
    },
    update: {
      userId: selfServiceUser.id,
      title: "Employee self-service ready",
      message: "Attendance, leave requests, and notifications are enabled.",
      category: "SYSTEM",
      isRead: false
    },
    create: {
      id: "seed-employee-self-service-ready",
      userId: selfServiceUser.id,
      title: "Employee self-service ready",
      message: "Attendance, leave requests, and notifications are enabled.",
      category: "SYSTEM",
      isRead: false
    }
  });

  await prisma.notification.upsert({
    where: {
      id: "seed-ankit-self-service-ready"
    },
    update: {
      userId: ankitUser.id,
      title: "Employee self-service ready",
      message: "Attendance, leave requests, and notifications are enabled.",
      category: "SYSTEM",
      isRead: false
    },
    create: {
      id: "seed-ankit-self-service-ready",
      userId: ankitUser.id,
      title: "Employee self-service ready",
      message: "Attendance, leave requests, and notifications are enabled.",
      category: "SYSTEM",
      isRead: false
    }
  });

  }

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
