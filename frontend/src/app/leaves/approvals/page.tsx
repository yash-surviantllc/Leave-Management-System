"use client";

import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { ProtectedPage } from "@/components/protected-page";
import {
  approveLeave,
  getApiErrorMessage,
  getPaginationMeta,
  listDepartments,
  listLeaveRequests,
  rejectLeave
} from "@/lib/api";
import { formatDate, getEmployeeName } from "@/lib/employee-format";
import { leaveStatusLabels } from "@/lib/time-format";
import type { AuthUser, LeaveRequestStatus } from "@/types";

type LeaveApprovalsContentProps = {
  user: AuthUser;
  token: string;
};

const pageSize = 25;

function LeaveApprovalsContent({ user, token }: LeaveApprovalsContentProps) {
  const [status, setStatus] = useState<LeaveRequestStatus | "">("PENDING");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [status, departmentId]);

  const leaveRequestsQuery = useQuery({
    queryKey: ["leave-approvals", token, status, departmentId, page],
    queryFn: () =>
      listLeaveRequests(token, {
        status,
        departmentId,
        page,
        pageSize
      }),
    retry: false
  });
  const departmentsQuery = useQuery({
    queryKey: ["departments", token, "leave-approvals"],
    queryFn: () => listDepartments(token),
    retry: false
  });
  const leaveRequests = leaveRequestsQuery.data?.success
    ? leaveRequestsQuery.data.data.leaveRequests
    : [];
  const departments = departmentsQuery.data?.success
    ? departmentsQuery.data.data.departments
    : [];
  const pagination = useMemo(
    () => (leaveRequestsQuery.data ? getPaginationMeta(leaveRequestsQuery.data) : null),
    [leaveRequestsQuery.data]
  );

  async function reviewLeave(id: string, decision: "approve" | "reject") {
    setActionError(null);
    const note = window.prompt("Decision note")?.trim() ?? null;
    const response =
      decision === "approve"
        ? await approveLeave(token, id, { decisionNote: note }).catch(() => null)
        : await rejectLeave(token, id, { decisionNote: note }).catch(() => null);

    if (!response) {
      setActionError("Unable to reach the API");
      return;
    }

    if (!response.success) {
      setActionError(getApiErrorMessage(response));
      return;
    }

    void leaveRequestsQuery.refetch();
  }

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-brand-700">Leave</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
            Leave Approvals
          </h1>
        </div>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="h-11 rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600"
              value={status}
              onChange={(event) => setStatus(event.target.value as LeaveRequestStatus | "")}
            >
              <option value="">All statuses</option>
              {Object.entries(leaveStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
          </div>

          {actionError ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Leave</th>
                  <th className="px-4 py-3 font-semibold">Dates</th>
                  <th className="px-4 py-3 font-semibold">Days</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leaveRequests.map((leaveRequest) => (
                  <tr key={leaveRequest.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-ink">
                        {getEmployeeName(leaveRequest.employee)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {leaveRequest.employee.department?.name ?? "Unassigned"}
                      </div>
                    </td>
                    <td className="px-4 py-4">{leaveRequest.leaveType.name}</td>
                    <td className="px-4 py-4">
                      {formatDate(leaveRequest.startDate)} to {formatDate(leaveRequest.endDate)}
                    </td>
                    <td className="px-4 py-4">{leaveRequest.totalDays}</td>
                    <td className="px-4 py-4">{leaveStatusLabels[leaveRequest.status]}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="grid h-9 w-9 place-items-center rounded-md border border-line text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          onClick={() => reviewLeave(leaveRequest.id, "approve")}
                          disabled={leaveRequest.status !== "PENDING"}
                          aria-label="Approve leave"
                        >
                          <Check size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="grid h-9 w-9 place-items-center rounded-md border border-line text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          onClick={() => reviewLeave(leaveRequest.id, "reject")}
                          disabled={leaveRequest.status !== "PENDING"}
                          aria-label="Reject leave"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            pagination={pagination}
            onPageChange={setPage}
            isFetching={leaveRequestsQuery.isFetching}
          />
        </section>
      </div>
    </AppShell>
  );
}

export default function LeaveApprovalsPage() {
  return (
    <ProtectedPage requiredPermissions={["leave:approve"]}>
      {({ user, token }) => <LeaveApprovalsContent user={user} token={token} />}
    </ProtectedPage>
  );
}
