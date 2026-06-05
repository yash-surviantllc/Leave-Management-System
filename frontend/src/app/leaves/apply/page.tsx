"use client";

import { CalendarDays, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtectedPage } from "@/components/protected-page";
import {
  applyLeave,
  getApiErrorMessage,
  listLeaveBalances,
  listLeaveTypes
} from "@/lib/api";
import { leaveDayTypeLabels } from "@/lib/time-format";
import type { AuthUser, LeaveDayType } from "@/types";

type ApplyLeaveContentProps = {
  user: AuthUser;
  token: string;
};

type LeaveFormValues = {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  dayType: LeaveDayType;
  reason: string;
};

function ApplyLeaveContent({ user, token }: ApplyLeaveContentProps) {
  const [message, setMessage] = useState<string | null>(null);
  const leaveTypesQuery = useQuery({
    queryKey: ["leave-types", token],
    queryFn: () => listLeaveTypes(token),
    retry: false
  });
  const balancesQuery = useQuery({
    queryKey: ["leave-balances", token, new Date().getFullYear()],
    queryFn: () => listLeaveBalances(token, { year: new Date().getFullYear() }),
    retry: false
  });
  const {
    formState: { isSubmitting },
    handleSubmit,
    register,
    reset
  } = useForm<LeaveFormValues>({
    defaultValues: {
      leaveTypeId: "",
      startDate: "",
      endDate: "",
      dayType: "FULL_DAY",
      reason: ""
    }
  });
  const leaveTypes = leaveTypesQuery.data?.success
    ? leaveTypesQuery.data.data.leaveTypes.filter((leaveType) => leaveType.isActive)
    : [];
  const leaveBalances = balancesQuery.data?.success
    ? balancesQuery.data.data.leaveBalances
    : [];

  async function submit(values: LeaveFormValues) {
    setMessage(null);
    const response = await applyLeave(token, {
      leaveTypeId: values.leaveTypeId,
      startDate: values.startDate,
      endDate: values.endDate,
      dayType: values.dayType,
      reason: values.reason.trim()
    }).catch(() => null);

    if (!response) {
      setMessage("Unable to reach the API");
      return;
    }

    if (!response.success) {
      setMessage(getApiErrorMessage(response));
      return;
    }

    setMessage("Leave request submitted");
    reset();
    void balancesQuery.refetch();
  }

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-brand-700">Leave</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
            Apply Leave
          </h1>
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <form
            className="rounded-lg border border-line bg-white p-5 shadow-soft"
            onSubmit={handleSubmit(submit)}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-50 text-brand-700">
                <CalendarDays size={20} aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold tracking-normal">Request Leave</h2>
            </div>

            {message ? (
              <div className="mt-5 rounded-md border border-line bg-surface px-3 py-2 text-sm text-slate-700">
                {message}
              </div>
            ) : null}

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Leave type
              <select
                className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600"
                {...register("leaveTypeId", { required: true })}
              >
                <option value="">Select leave type</option>
                {leaveTypes.map((leaveType) => (
                  <option key={leaveType.id} value={leaveType.id}>
                    {leaveType.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="block text-sm font-medium text-slate-700">
                Start
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                  type="date"
                  {...register("startDate", { required: true })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                End
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                  type="date"
                  {...register("endDate", { required: true })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Day type
                <select
                  className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600"
                  {...register("dayType")}
                >
                  {Object.entries(leaveDayTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Reason
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-line px-3 py-3 text-sm outline-none transition focus:border-brand-600"
                {...register("reason", { required: true })}
              />
            </label>
            <button
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              <Send size={17} aria-hidden="true" />
              Submit request
            </button>
          </form>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold tracking-normal">Current Balances</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {leaveBalances.map((balance) => (
                <div key={balance.id} className="rounded-md bg-surface px-4 py-3">
                  <p className="font-medium text-ink">{balance.leaveType.name}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-normal text-brand-700">
                    {balance.available}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Used {balance.used} | Pending {balance.pending}
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

export default function ApplyLeavePage() {
  return (
    <ProtectedPage requiredPermissions={["leave:request"]}>
      {({ user, token }) => <ApplyLeaveContent user={user} token={token} />}
    </ProtectedPage>
  );
}
