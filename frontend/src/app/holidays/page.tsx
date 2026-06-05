"use client";

import { CalendarCheck, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtectedPage } from "@/components/protected-page";
import { createHoliday, getApiErrorMessage, listHolidays } from "@/lib/api";
import { formatDate } from "@/lib/employee-format";
import { hasAnyPermission } from "@/lib/permissions";
import { holidayTypeLabels } from "@/lib/time-format";
import type { AuthUser, HolidayType } from "@/types";

type HolidaysContentProps = {
  user: AuthUser;
  token: string;
};

type HolidayFormValues = {
  name: string;
  date: string;
  type: HolidayType;
  description: string;
};

const holidayReadPermissions = [
  "attendance:manage",
  "attendance:read",
  "attendance:write",
  "leave:request",
  "leave:approve",
  "leave:manage"
];

const holidayManagePermissions = ["attendance:manage", "leave:manage"];

function HolidaysContent({ user, token }: HolidaysContentProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const canManageHolidays = hasAnyPermission(user, holidayManagePermissions);
  const holidaysQuery = useQuery({
    queryKey: ["holidays", token, year],
    queryFn: () => listHolidays(token, year),
    retry: false
  });
  const {
    formState: { isSubmitting },
    handleSubmit,
    register,
    reset
  } = useForm<HolidayFormValues>({
    defaultValues: {
      name: "",
      date: "",
      type: "PUBLIC",
      description: ""
    }
  });
  const holidays = holidaysQuery.data?.success ? holidaysQuery.data.data.holidays : [];

  async function submit(values: HolidayFormValues) {
    setError(null);
    const response = await createHoliday(token, {
      name: values.name.trim(),
      date: values.date,
      type: values.type,
      description: values.description.trim() || null
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
    void holidaysQuery.refetch();
  }

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-brand-700">Attendance</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
            Holiday Calendar
          </h1>
        </div>

        <section
          className={`grid gap-4 ${
            canManageHolidays ? "lg:grid-cols-[0.8fr_1.2fr]" : ""
          }`}
        >
          {canManageHolidays ? (
            <form
              className="rounded-lg border border-line bg-white p-5 shadow-soft"
              onSubmit={handleSubmit(submit)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-50 text-brand-700">
                  <CalendarCheck size={20} aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold tracking-normal">Add Holiday</h2>
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
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Date
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                    type="date"
                    {...register("date", { required: true })}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Type
                  <select
                    className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600"
                    {...register("type")}
                  >
                    {Object.entries(holidayTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-5 block text-sm font-medium text-slate-700">
                Description
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border border-line px-3 py-3 text-sm outline-none transition focus:border-brand-600"
                  {...register("description")}
                />
              </label>
              <button
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                <Plus size={17} aria-hidden="true" />
                Create holiday
              </button>
            </form>
          ) : null}

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-lg font-semibold tracking-normal">Calendar</h2>
              <input
                className="h-10 w-32 rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                type="number"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </div>
            <div className="mt-5 overflow-hidden rounded-md border border-line">
              {holidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="grid gap-3 border-b border-line px-4 py-4 last:border-0 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-medium text-ink">{holiday.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(holiday.date)}
                    </p>
                  </div>
                  <span className="self-start rounded-md bg-surface px-2 py-1 text-xs font-medium text-slate-600">
                    {holidayTypeLabels[holiday.type]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default function HolidaysPage() {
  return (
    <ProtectedPage permissionMode="any" requiredPermissions={holidayReadPermissions}>
      {({ user, token }) => <HolidaysContent user={user} token={token} />}
    </ProtectedPage>
  );
}
