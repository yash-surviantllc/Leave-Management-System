"use client";

import { ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { ProtectedPage } from "@/components/protected-page";
import { getPaginationMeta, listLeaveBalances } from "@/lib/api";
import { getEmployeeName } from "@/lib/employee-format";
import type { AuthUser } from "@/types";

type LeaveBalancesContentProps = {
  user: AuthUser;
  token: string;
};

const pageSize = 25;

function LeaveBalancesContent({ user, token }: LeaveBalancesContentProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [year]);

  const balancesQuery = useQuery({
    queryKey: ["leave-balances", token, year, page],
    queryFn: () => listLeaveBalances(token, { year, page, pageSize }),
    retry: false
  });
  const leaveBalances = balancesQuery.data?.success
    ? balancesQuery.data.data.leaveBalances
    : [];
  const pagination = useMemo(
    () => (balancesQuery.data ? getPaginationMeta(balancesQuery.data) : null),
    [balancesQuery.data]
  );

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-50 text-brand-700">
              <ClipboardList size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-700">Leave</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
                Leave Balances
              </h1>
            </div>
          </div>
          <input
            className="h-10 w-32 rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
            type="number"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          />
        </div>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Opening</th>
                  <th className="px-4 py-3 font-semibold">Used</th>
                  <th className="px-4 py-3 font-semibold">Pending</th>
                  <th className="px-4 py-3 font-semibold">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leaveBalances.map((balance) => (
                  <tr key={balance.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-ink">
                        {getEmployeeName(balance.employee)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {balance.employee.employeeCode}
                      </div>
                    </td>
                    <td className="px-4 py-4">{balance.leaveType.name}</td>
                    <td className="px-4 py-4">{balance.openingBalance}</td>
                    <td className="px-4 py-4">{balance.used}</td>
                    <td className="px-4 py-4">{balance.pending}</td>
                    <td className="px-4 py-4 font-semibold text-brand-700">
                      {balance.available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            pagination={pagination}
            onPageChange={setPage}
            isFetching={balancesQuery.isFetching}
          />
        </section>
      </div>
    </AppShell>
  );
}

export default function LeaveBalancesPage() {
  return (
    <ProtectedPage requiredPermissions={["leave:request"]}>
      {({ user, token }) => <LeaveBalancesContent user={user} token={token} />}
    </ProtectedPage>
  );
}
