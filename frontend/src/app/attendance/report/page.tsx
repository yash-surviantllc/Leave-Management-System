"use client";

import { ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { ProtectedPage } from "@/components/protected-page";
import {
  getAttendanceReport,
  getPaginationMeta,
  listDepartments,
  listEmployees
} from "@/lib/api";
import { formatDate, getEmployeeName } from "@/lib/employee-format";
import {
  attendanceStatusLabels,
  formatDateTime,
  getMonthStartInputValue,
  getTodayInputValue
} from "@/lib/time-format";
import type { AttendanceStatus, AuthUser } from "@/types";

type AttendanceReportContentProps = {
  user: AuthUser;
  token: string;
};

const pageSize = 25;

function AttendanceReportContent({ user, token }: AttendanceReportContentProps) {
  const [dateFrom, setDateFrom] = useState(getMonthStartInputValue());
  const [dateTo, setDateTo] = useState(getTodayInputValue());
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState<AttendanceStatus | "">("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, employeeId, departmentId, status]);

  const reportQuery = useQuery({
    queryKey: [
      "attendance-report",
      token,
      dateFrom,
      dateTo,
      employeeId,
      departmentId,
      status,
      page
    ],
    queryFn: () =>
      getAttendanceReport(token, {
        dateFrom,
        dateTo,
        employeeId,
        departmentId,
        status,
        page,
        pageSize
      }),
    retry: false
  });
  const canManageEmployees = user.permissions.includes("employees:manage");
  const employeesQuery = useQuery({
    queryKey: ["employees", token, "attendance-report"],
    queryFn: () => listEmployees(token, { pageSize: 100 }),
    retry: false,
    enabled: canManageEmployees
  });
  const departmentsQuery = useQuery({
    queryKey: ["departments", token, "attendance-report"],
    queryFn: () => listDepartments(token),
    retry: false
  });
  const attendance = reportQuery.data?.success
    ? reportQuery.data.data.attendance
    : [];
  const employees = employeesQuery.data?.success
    ? employeesQuery.data.data.employees
    : [];
  const departments = departmentsQuery.data?.success
    ? departmentsQuery.data.data.departments
    : [];
  const pagination = useMemo(
    () => (reportQuery.data ? getPaginationMeta(reportQuery.data) : null),
    [reportQuery.data]
  );

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-50 text-brand-700">
            <ClipboardList size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-700">Attendance</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
              Attendance Report
            </h1>
          </div>
        </div>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              className="h-11 rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <input
              className="h-11 rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
            {canManageEmployees ? (
              <select
                className="h-11 rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
              >
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {getEmployeeName(employee)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex h-11 items-center rounded-md border border-line bg-surface px-3 text-sm text-slate-500">
                Direct reports
              </div>
            )}
            <select
              className="h-11 rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600"
              value={status}
              onChange={(event) => setStatus(event.target.value as AttendanceStatus | "")}
            >
              <option value="">All statuses</option>
              {Object.entries(attendanceStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Clock in</th>
                  <th className="px-4 py-3 font-semibold">Clock out</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attendance.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-ink">
                        {getEmployeeName(record.employee)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {record.employee.employeeCode}
                      </div>
                    </td>
                    <td className="px-4 py-4">{formatDate(record.date)}</td>
                    <td className="px-4 py-4">{attendanceStatusLabels[record.status]}</td>
                    <td className="px-4 py-4">{formatDateTime(record.clockInAt)}</td>
                    <td className="px-4 py-4">{formatDateTime(record.clockOutAt)}</td>
                    <td className="px-4 py-4">
                      {record.employee.department?.name ?? "Unassigned"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!reportQuery.isLoading && attendance.length === 0 ? (
            <p className="mt-5 rounded-md border border-dashed border-line px-4 py-5 text-sm text-slate-500">
              No attendance records found for the selected filters.
            </p>
          ) : null}
          <PaginationControls
            pagination={pagination}
            onPageChange={setPage}
            isFetching={reportQuery.isFetching}
          />
        </section>
      </div>
    </AppShell>
  );
}

export default function AttendanceReportPage() {
  return (
    <ProtectedPage requiredPermissions={["attendance:read"]}>
      {({ user, token }) => <AttendanceReportContent user={user} token={token} />}
    </ProtectedPage>
  );
}
