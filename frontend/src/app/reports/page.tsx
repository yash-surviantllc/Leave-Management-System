"use client";

import { BarChart3, CalendarDays, Clock3, Users } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtectedPage } from "@/components/protected-page";
import { StatusCard } from "@/components/status-card";
import {
  getAttendanceReportData,
  getEmployeeReport,
  getLeaveReportData
} from "@/lib/api";
import { formatDate, getEmployeeName } from "@/lib/employee-format";
import { getMonthStartInputValue, getTodayInputValue } from "@/lib/time-format";
import type { AuthUser } from "@/types";

type ReportsContentProps = {
  user: AuthUser;
  token: string;
};

function ReportsContent({ user, token }: ReportsContentProps) {
  const [dateFrom, setDateFrom] = useState(getMonthStartInputValue());
  const [dateTo, setDateTo] = useState(getTodayInputValue());
  const employeesQuery = useQuery({
    queryKey: ["report-employees", token, dateFrom, dateTo],
    queryFn: () => getEmployeeReport(token, { dateFrom, dateTo }),
    retry: false
  });
  const attendanceQuery = useQuery({
    queryKey: ["report-attendance", token, dateFrom, dateTo],
    queryFn: () => getAttendanceReportData(token, { dateFrom, dateTo }),
    retry: false
  });
  const leavesQuery = useQuery({
    queryKey: ["report-leaves", token, dateFrom, dateTo],
    queryFn: () => getLeaveReportData(token, { dateFrom, dateTo }),
    retry: false
  });
  const employeeReport = employeesQuery.data?.success ? employeesQuery.data.data : null;
  const attendanceReport = attendanceQuery.data?.success ? attendanceQuery.data.data : null;
  const leaveReport = leavesQuery.data?.success ? leavesQuery.data.data : null;

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-50 text-brand-700">
              <BarChart3 size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-700">Reports</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
                HR Reports
              </h1>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="h-10 rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <input
              className="h-10 rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatusCard
            label="Employees"
            value={String(employeeReport?.summary.total ?? 0)}
            detail="Joined in selected range"
            icon={Users}
            tone="brand"
          />
          <StatusCard
            label="Attendance"
            value={String(attendanceReport?.summary.total ?? 0)}
            detail="Records in selected range"
            icon={Clock3}
            tone="blue"
          />
          <StatusCard
            label="Leave Requests"
            value={String(leaveReport?.summary.total ?? 0)}
            detail="Requests in selected range"
            icon={CalendarDays}
            tone="amber"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold tracking-normal">Employee Report</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="border-b border-line bg-surface text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(employeeReport?.employees ?? []).slice(0, 8).map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-4 py-4">
                        <div className="font-medium text-ink">{getEmployeeName(employee)}</div>
                        <div className="mt-1 text-xs text-slate-500">{employee.employeeCode}</div>
                      </td>
                      <td className="px-4 py-4">{employee.department?.name ?? "Unassigned"}</td>
                      <td className="px-4 py-4">{formatDate(employee.dateOfJoining)}</td>
                      <td className="px-4 py-4">{employee.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold tracking-normal">Leave Report</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="border-b border-line bg-surface text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Days</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(leaveReport?.leaveRequests ?? []).slice(0, 8).map((leaveRequest) => (
                    <tr key={leaveRequest.id}>
                      <td className="px-4 py-4">{getEmployeeName(leaveRequest.employee)}</td>
                      <td className="px-4 py-4">{leaveRequest.leaveType.name}</td>
                      <td className="px-4 py-4">{leaveRequest.totalDays}</td>
                      <td className="px-4 py-4">{leaveRequest.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold tracking-normal">Attendance Summary</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {Object.entries(attendanceReport?.summary.byStatus ?? {}).map(([status, total]) => (
                <div key={status} className="rounded-md bg-surface px-4 py-3">
                  <p className="text-sm font-medium text-ink">{status}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-normal text-brand-700">
                    {total}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedPage requiredPermissions={["reports:read"]}>
      {({ user, token }) => <ReportsContent user={user} token={token} />}
    </ProtectedPage>
  );
}
