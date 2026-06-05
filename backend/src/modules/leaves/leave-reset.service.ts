import { prisma } from "../../lib/prisma";

function getFiscalYear(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12
  
  // Fiscal year runs April 1st to March 31st
  return month >= 4 ? year : year - 1;
}

function calculateCarryForward(previousYearBalance: {
  openingBalance: number;
  accrued: number;
  used: number;
  pending: number;
}): number {
  return Math.max(0, previousYearBalance.openingBalance + previousYearBalance.accrued - previousYearBalance.used - previousYearBalance.pending);
}

export async function performAnnualLeaveReset(): Promise<void> {
  const currentFiscalYear = getFiscalYear(new Date());
  const previousFiscalYear = currentFiscalYear - 1;
  
  const allEmployees = await prisma.employee.findMany({
    where: { status: "ACTIVE" }
  });
  
  const allLeaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true }
  });
  
  await prisma.$transaction(async (transaction) => {
    for (const employee of allEmployees) {
      for (const leaveType of allLeaveTypes) {
        // Get previous year balance
        const previousBalance = await transaction.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year: previousFiscalYear
            }
          }
        });
        
        // Calculate carry-forward
        const carryForward = previousBalance 
          ? calculateCarryForward(previousBalance)
          : 0;
        
        // Create or update current year balance
        await transaction.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year: currentFiscalYear
            }
          },
          update: {
            carryForward: carryForward,
            lastResetDate: new Date()
          },
          create: {
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: currentFiscalYear,
            openingBalance: leaveType.defaultAnnualAllowance,
            carryForward: carryForward,
            lastResetDate: new Date(),
            available: leaveType.defaultAnnualAllowance + carryForward
          }
        });
      }
    }
  });
}
