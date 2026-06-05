import type { Employee, EmployeeManager, EmploymentStatus } from "@/types";

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE: "Active",
  PROBATION: "Probation",
  INACTIVE: "Inactive",
  TERMINATED: "Terminated"
};

export function getEmployeeName(
  employee: Pick<Employee, "firstName" | "lastName"> | EmployeeManager
): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function toDateInputValue(value: string | null): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}
