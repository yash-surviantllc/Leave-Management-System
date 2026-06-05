"use client";

import { Plus, Settings } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtectedPage } from "@/components/protected-page";
import { createLeaveType, getApiErrorMessage, listLeaveTypes } from "@/lib/api";
import type { AuthUser } from "@/types";

type LeaveTypesContentProps = {
  user: AuthUser;
  token: string;
};

type LeaveTypeFormValues = {
  name: string;
  description: string;
  defaultAnnualAllowance: number;
  isPaid: boolean;
  requiresApproval: boolean;
  isActive: boolean;
};

function LeaveTypesContent({ user, token }: LeaveTypesContentProps) {
  const [error, setError] = useState<string | null>(null);
  const leaveTypesQuery = useQuery({
    queryKey: ["leave-types", token, "settings"],
    queryFn: () => listLeaveTypes(token),
    retry: false
  });
  const {
    formState: { isSubmitting },
    handleSubmit,
    register,
    reset
  } = useForm<LeaveTypeFormValues>({
    defaultValues: {
      name: "",
      description: "",
      defaultAnnualAllowance: 0,
      isPaid: true,
      requiresApproval: true,
      isActive: true
    }
  });
  const leaveTypes = leaveTypesQuery.data?.success
    ? leaveTypesQuery.data.data.leaveTypes
    : [];

  async function submit(values: LeaveTypeFormValues) {
    setError(null);
    const response = await createLeaveType(token, {
      name: values.name.trim(),
      description: values.description.trim() || null,
      defaultAnnualAllowance: Number(values.defaultAnnualAllowance),
      isPaid: values.isPaid,
      requiresApproval: values.requiresApproval,
      isActive: values.isActive
    }).catch(() => null);

    if (!response) {
      setError("Unable to reach the API");
      return;
    }

    if (!response.success) {
      setError(getApiErrorMessage(response));
      return;
    }

    reset();
    void leaveTypesQuery.refetch();
  }

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-brand-700">Leave</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
            Leave Settings
          </h1>
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <form
            className="rounded-lg border border-line bg-white p-5 shadow-soft"
            onSubmit={handleSubmit(submit)}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-50 text-brand-700">
                <Settings size={20} aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold tracking-normal">Add Leave Type</h2>
            </div>

            {error ? (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Name
              <input
                className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                {...register("name", { required: true })}
              />
            </label>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Annual allowance
              <input
                className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                type="number"
                step="0.5"
                {...register("defaultAnnualAllowance", { valueAsNumber: true })}
              />
            </label>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Description
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-line px-3 py-3 text-sm outline-none transition focus:border-brand-600"
                {...register("description")}
              />
            </label>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" {...register("isPaid")} />
                Paid
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" {...register("requiresApproval")} />
                Requires approval
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" {...register("isActive")} />
                Active
              </label>
            </div>
            <button
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              <Plus size={17} aria-hidden="true" />
              Create leave type
            </button>
          </form>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold tracking-normal">Leave Types</h2>
            <div className="mt-5 overflow-hidden rounded-md border border-line">
              {leaveTypes.map((leaveType) => (
                <div
                  key={leaveType.id}
                  className="grid gap-3 border-b border-line px-4 py-4 last:border-0 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-medium text-ink">{leaveType.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {leaveType.description ?? "No description"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <span className="rounded-md bg-surface px-2 py-1">
                      {leaveType.defaultAnnualAllowance} days
                    </span>
                    <span className="rounded-md bg-surface px-2 py-1">
                      {leaveType.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default function LeaveTypesPage() {
  return (
    <ProtectedPage requiredPermissions={["leave:manage"]}>
      {({ user, token }) => <LeaveTypesContent user={user} token={token} />}
    </ProtectedPage>
  );
}
