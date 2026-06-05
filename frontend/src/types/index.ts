export type RoleName = "SUPER_ADMIN" | "HR_ADMIN" | "MANAGER" | "EMPLOYEE";

export type AccountStatus = "ACTIVE" | "INACTIVE" | "TERMINATED";

export type EmploymentStatus =
  | "ONBOARDING"
  | "ACTIVE"
  | "PROBATION"
  | "INACTIVE"
  | "TERMINATED";

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "HALF_DAY"
  | "ABSENT"
  | "WORK_FROM_HOME";

export type AttendanceWorkMode = "OFFICE" | "WORK_FROM_HOME";

export type HolidayType = "PUBLIC" | "COMPANY" | "OPTIONAL";

export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LeaveDayType = "FULL_DAY" | "HALF_DAY";




export type AuthUser = {
  id: string;
  name: string;
  email: string;
  status: AccountStatus;
  roles: RoleName[];
  permissions: string[];
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type Department = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    employees: number;
    designations: number;
  };
};

export type Designation = {
  id: string;
  title: string;
  description: string | null;
  departmentId: string | null;
  department: Department | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    employees: number;
  };
};

export type EmployeeManager = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  status: EmploymentStatus;
};

export type EmergencyContact = {
  id: string;
  employeeId: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};


export type Employee = {
  id: string;
  employeeCode: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  workEmail: string;
  personalEmail: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  dateOfJoining: string;
  dateOfExit: string | null;
  status: EmploymentStatus;
  location: string | null;
  departmentId: string | null;
  department: Department | null;
  designationId: string | null;
  designation: Designation | null;
  managerId: string | null;
  manager: EmployeeManager | null;
  emergencyContacts: EmergencyContact[];
  createdAt: string;
  updatedAt: string;
};

export type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateAfterMinutes: number;
  halfDayAfterMinutes: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Holiday = {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  department: Department | null;
  designation: Designation | null;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employee: AttendanceEmployee;
  shiftId: string | null;
  shift: Shift | null;
  date: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  status: AttendanceStatus;
  workMode: AttendanceWorkMode;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaveType = {
  id: string;
  name: string;
  description: string | null;
  defaultAnnualAllowance: number;
  isPaid: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeaveEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  userId?: string | null;
  department: Department | null;
  designation?: Designation | null;
};

export type LeaveReviewer = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employee: LeaveEmployee;
  leaveTypeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  dayType: LeaveDayType;
  totalDays: number;
  reason: string;
  status: LeaveRequestStatus;
  reviewerId: string | null;
  reviewer: LeaveReviewer | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaveBalance = {
  id: string;
  employeeId: string;
  employee: LeaveEmployee;
  leaveTypeId: string;
  leaveType: LeaveType;
  year: number;
  openingBalance: number;
  accrued: number;
  used: number;
  pending: number;
  available: number;
  createdAt: string;
  updatedAt: string;
};


export type NotificationRecord = {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};


export type DashboardCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "brand" | "blue" | "amber" | "slate";
};

export type DashboardSummary = {
  cards: DashboardCard[];
  notifications: NotificationRecord[];
  scope: "organization" | "self_or_team";
};

export type ReportEmployee = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  status: EmploymentStatus;
  dateOfJoining: string;
  dateOfExit: string | null;
  department: Department | null;
  designation: Designation | null;
};

export type EmployeeReport = {
  employees: ReportEmployee[];
  summary: {
    total: number;
    byStatus: Partial<Record<EmploymentStatus, number>>;
    byDepartment: Record<string, number>;
  };
};

export type AttendanceReport = {
  attendance: AttendanceRecord[];
  summary: {
    total: number;
    byStatus: Partial<Record<AttendanceStatus, number>>;
  };
};

export type LeaveReport = {
  leaveRequests: LeaveRequest[];
  summary: {
    total: number;
    byStatus: Partial<Record<LeaveRequestStatus, number>>;
    byType: Record<string, number>;
  };
};



