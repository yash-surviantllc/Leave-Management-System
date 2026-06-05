"use client";

import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { ProtectedPage } from "@/components/protected-page";
import { getPaginationMeta, listMyLeaves } from "@/lib/api";
import { formatDate } from "@/lib/employee-format";
import { leaveDayTypeLabels, leaveStatusLabels } from "@/lib/time-format";
import type { AuthUser } from "@/types";

type MyLeavesContentProps = {
  user: AuthUser;
  token: string;
};

const pageSize = 25;

function MyLeavesContent({ user, token }: MyLeavesContentProps) {
  const [page, setPage] = useState(1);
  const leavesQuery = useQuery({
    queryKey: ["my-leaves", token, page],
    queryFn: () => listMyLeaves(token, { page, pageSize }),
    retry: false
  });
  const leaveRequests = leavesQuery.data?.success
    ? leavesQuery.data.data.leaveRequests
    : [];
  const pagination = useMemo(
    () => (leavesQuery.data ? getPaginationMeta(leavesQuery.data) : null),
    [leavesQuery.data]
  );

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-50 text-brand-700">
            <CalendarDays size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-700">Leave</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
              My Leave History
            </h1>
          </div>
        </div>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Dates</th>
                  <th className="px-4 py-3 font-semibold">Days</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leaveRequests.map((leaveRequest) => (
                  <tr key={leaveRequest.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-ink">
                        {leaveRequest.leaveType.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {leaveDayTypeLabels[leaveRequest.dayType]}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {formatDate(leaveRequest.startDate)} to {formatDate(leaveRequest.endDate)}
                    </td>
                    <td className="px-4 py-4">{leaveRequest.totalDays}</td>
                    <td className="px-4 py-4">{leaveStatusLabels[leaveRequest.status]}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {leaveRequest.decisionNote ?? "Not reviewed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!leavesQuery.isLoading && leaveRequests.length === 0 ? (
            <p className="mt-5 rounded-md border border-dashed border-line px-4 py-5 text-sm text-slate-500">
              No leave requests found.
            </p>
          ) : null}
          <PaginationControls
            pagination={pagination}
            onPageChange={setPage}
            isFetching={leavesQuery.isFetching}
          />
        </section>
      </div>
    </AppShell>
  );
}

export default function MyLeavesPage() {
  return (
    <ProtectedPage requiredPermissions={["leave:request"]}>
      {({ user, token }) => <MyLeavesContent user={user} token={token} />}
    </ProtectedPage>
  );
}
