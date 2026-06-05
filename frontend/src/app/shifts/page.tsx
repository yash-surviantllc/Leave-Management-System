"use client";

import { Clock3, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtectedPage } from "@/components/protected-page";
import { createShift, getApiErrorMessage, listShifts } from "@/lib/api";
import type { AuthUser } from "@/types";

type ShiftsContentProps = {
  user: AuthUser;
  token: string;
};

type ShiftFormValues = {
  name: string;
  startTime: string;
  endTime: string;
  lateAfterMinutes: number;
  halfDayAfterMinutes: number;
  isDefault: boolean;
  isActive: boolean;
};

function ShiftsContent({ user, token }: ShiftsContentProps) {
  const [error, setError] = useState<string | null>(null);
  const shiftsQuery = useQuery({
    queryKey: ["shifts", token],
    queryFn: () => listShifts(token),
    retry: false
  });
  const {
    formState: { isSubmitting },
    handleSubmit,
    register,
    reset
  } = useForm<ShiftFormValues>({
    defaultValues: {
      name: "",
      startTime: "09:30",
      endTime: "18:30",
      lateAfterMinutes: 15,
      halfDayAfterMinutes: 240,
      isDefault: false,
      isActive: true
    }
  });
  const shifts = shiftsQuery.data?.success ? shiftsQuery.data.data.shifts : [];

  async function submit(values: ShiftFormValues) {
    setError(null);
    const response = await createShift(token, {
      ...values,
      lateAfterMinutes: Number(values.lateAfterMinutes),
      halfDayAfterMinutes: Number(values.halfDayAfterMinutes)
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
    void shiftsQuery.refetch();
  }

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-brand-700">Attendance</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
            Shift Settings
          </h1>
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <form
            className="rounded-lg border border-line bg-white p-5 shadow-soft"
            onSubmit={handleSubmit(submit)}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-50 text-brand-700">
                <Clock3 size={20} aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold tracking-normal">Add Shift</h2>
            </div>

            {error ? (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Name
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                  {...register("name", { required: true })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Start
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                  type="time"
                  {...register("startTime", { required: true })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                End
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                  type="time"
                  {...register("endTime", { required: true })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Late after minutes
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                  type="number"
                  {...register("lateAfterMinutes", { valueAsNumber: true })}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Half day below minutes
                <input
                  className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                  type="number"
                  {...register("halfDayAfterMinutes", { valueAsNumber: true })}
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" {...register("isDefault")} />
                Default shift
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
              Create shift
            </button>
          </form>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold tracking-normal">Configured Shifts</h2>
            <div className="mt-5 overflow-hidden rounded-md border border-line">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="grid gap-3 border-b border-line px-4 py-4 last:border-0 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-medium text-ink">{shift.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {shift.startTime} to {shift.endTime}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    {shift.isDefault ? (
                      <span className="rounded-md bg-brand-50 px-2 py-1 text-brand-700">
                        Default
                      </span>
                    ) : null}
                    <span className="rounded-md bg-surface px-2 py-1">
                      {shift.isActive ? "Active" : "Inactive"}
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

export default function ShiftsPage() {
  return (
    <ProtectedPage requiredPermissions={["attendance:manage"]}>
      {({ user, token }) => <ShiftsContent user={user} token={token} />}
    </ProtectedPage>
  );
}
