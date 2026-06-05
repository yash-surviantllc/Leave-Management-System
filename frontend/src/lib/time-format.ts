import type {
  AttendanceStatus,
  AttendanceWorkMode,
  HolidayType,
  LeaveDayType,
  LeaveRequestStatus
} from "@/types";

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  LATE: "Late",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
  WORK_FROM_HOME: "Work from home"
};

export const attendanceWorkModeLabels: Record<AttendanceWorkMode, string> = {
  OFFICE: "Office",
  WORK_FROM_HOME: "Work from home"
};

export const holidayTypeLabels: Record<HolidayType, string> = {
  PUBLIC: "Public",
  COMPANY: "Company",
  OPTIONAL: "Optional"
};

export const leaveStatusLabels: Record<LeaveRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled"
};

export const leaveDayTypeLabels: Record<LeaveDayType, string> = {
  FULL_DAY: "Full day",
  HALF_DAY: "Half day"
};

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getMonthStartInputValue(): string {
  const now = new Date();

  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
    .toISOString()
    .slice(0, 10);
}
