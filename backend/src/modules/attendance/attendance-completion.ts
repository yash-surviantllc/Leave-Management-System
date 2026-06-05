import { EmploymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { addUtcDays, getDateKey, toDateOnlyFromDate } from "../../utils/date";

const attendanceEligibleStatuses = [
  EmploymentStatus.ONBOARDING,
  EmploymentStatus.ACTIVE,
  EmploymentStatus.PROBATION
];

const absentNote = "Automatically marked absent for missed attendance";

type AttendanceCompletionEmployee = {
  id: string;
  dateOfJoining: Date;
  dateOfExit: Date | null;
};

function getDateRangeStart(input: {
  dateFrom: Date;
  employee: AttendanceCompletionEmployee;
}): Date {
  return input.employee.dateOfJoining > input.dateFrom
    ? input.employee.dateOfJoining
    : input.dateFrom;
}

function getDateRangeEnd(input: {
  dateTo: Date;
  employee: AttendanceCompletionEmployee;
}): Date {
  if (input.employee.dateOfExit && input.employee.dateOfExit < input.dateTo) {
    return input.employee.dateOfExit;
  }

  return input.dateTo;
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();

  return day === 0 || day === 6;
}

function isWorkday(input: {
  date: Date;
  holidayDates: Set<string>;
  approvedLeaveDates: Set<string>;
}): boolean {
  const dateKey = getDateKey(input.date);

  return (
    !isWeekend(input.date) &&
    !input.holidayDates.has(dateKey) &&
    !input.approvedLeaveDates.has(dateKey)
  );
}

function getApprovedLeaveDates(input: {
  employeeId: string;
  dateFrom: Date;
  dateTo: Date;
}): string[] {
  const dates: string[] = [];

  for (
    let date = new Date(input.dateFrom);
    date <= input.dateTo;
    date = addUtcDays(date, 1)
  ) {
    dates.push(`${input.employeeId}:${getDateKey(date)}`);
  }

  return dates;
}

export async function materializeMissingAbsences(input: {
  dateFrom: Date;
  dateTo: Date;
  employeeId?: string;
  employeeWhere?: Prisma.EmployeeWhereInput;
}): Promise<number> {
  const yesterday = addUtcDays(toDateOnlyFromDate(new Date()), -1);
  const dateTo = input.dateTo < yesterday ? input.dateTo : yesterday;

  if (input.dateFrom > dateTo) {
    return 0;
  }

  const employeeWhere: Prisma.EmployeeWhereInput = {
    ...input.employeeWhere,
    ...(input.employeeId ? { id: input.employeeId } : {}),
    status: {
      in: attendanceEligibleStatuses
    },
    dateOfJoining: {
      lte: dateTo
    },
    OR: [
      {
        dateOfExit: null
      },
      {
        dateOfExit: {
          gte: input.dateFrom
        }
      }
    ]
  };
  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: {
      id: true,
      dateOfJoining: true,
      dateOfExit: true
    }
  });

  if (employees.length === 0) {
    return 0;
  }

  const employeeIds = employees.map((employee) => employee.id);
  const [holidays, approvedLeaves, existingAttendance] = await prisma.$transaction([
    prisma.holiday.findMany({
      where: {
        date: {
          gte: input.dateFrom,
          lte: dateTo
        }
      },
      select: {
        date: true
      }
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: {
          in: employeeIds
        },
        status: "APPROVED",
        startDate: {
          lte: dateTo
        },
        endDate: {
          gte: input.dateFrom
        }
      },
      select: {
        employeeId: true,
        startDate: true,
        endDate: true
      }
    }),
    prisma.attendance.findMany({
      where: {
        employeeId: {
          in: employeeIds
        },
        date: {
          gte: input.dateFrom,
          lte: dateTo
        }
      },
      select: {
        employeeId: true,
        date: true
      }
    })
  ]);
  const holidayDates = new Set(holidays.map((holiday) => getDateKey(holiday.date)));
  const approvedLeaveDates = new Set(
    approvedLeaves.flatMap((leaveRequest) =>
      getApprovedLeaveDates({
        employeeId: leaveRequest.employeeId,
        dateFrom: leaveRequest.startDate < input.dateFrom ? input.dateFrom : leaveRequest.startDate,
        dateTo: leaveRequest.endDate > dateTo ? dateTo : leaveRequest.endDate
      })
    )
  );
  const existingAttendanceDates = new Set(
    existingAttendance.map(
      (attendance) => `${attendance.employeeId}:${getDateKey(attendance.date)}`
    )
  );
  const absentAttendance = employees.flatMap((employee) => {
    const dateFrom = getDateRangeStart({ dateFrom: input.dateFrom, employee });
    const employeeDateTo = getDateRangeEnd({ dateTo, employee });
    const attendance: Prisma.AttendanceCreateManyInput[] = [];

    for (
      let date = new Date(dateFrom);
      date <= employeeDateTo;
      date = addUtcDays(date, 1)
    ) {
      const dateKey = getDateKey(date);
      const employeeDateKey = `${employee.id}:${dateKey}`;

      if (
        existingAttendanceDates.has(employeeDateKey) ||
        !isWorkday({ date, holidayDates, approvedLeaveDates })
      ) {
        continue;
      }

      attendance.push({
        employeeId: employee.id,
        date,
        status: "ABSENT",
        workMode: "OFFICE",
        notes: absentNote
      });
    }

    return attendance;
  });

  if (absentAttendance.length === 0) {
    return 0;
  }

  const result = await prisma.attendance.createMany({
    data: absentAttendance,
    skipDuplicates: true
  });

  return result.count;
}
