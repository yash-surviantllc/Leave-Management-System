"use client";

import { BriefcaseBusiness, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtectedPage } from "@/components/protected-page";
import {
  createDesignation,
  deleteDesignation,
  getApiErrorMessage,
  listDepartments,
  listDesignations
} from "@/lib/api";
import type { AuthUser } from "@/types";

type DesignationsContentProps = {
  user: AuthUser;
  token: string;
};

type DesignationFormValues = {
  title: string;
  description: string;
  departmentId: string;
};

function DesignationsContent({ user, token }: DesignationsContentProps) {
  const [error, setError] = useState<string | null>(null);
  const [deletingDesignationId, setDeletingDesignationId] = useState<string | null>(null);
  const departmentsQuery = useQuery({
    queryKey: ["departments", token],
    queryFn: () => listDepartments(token),
    retry: false
  });
  const designationsQuery = useQuery({
    queryKey: ["designations", token],
    queryFn: () => listDesignations(token),
    retry: false
  });
  const {
    formState: { isSubmitting },
    handleSubmit,
    register,
    reset
  } = useForm<DesignationFormValues>({
    defaultValues: {
      title: "",
      description: "",
      departmentId: ""
    }
  });
  const departments = departmentsQuery.data?.success
    ? departmentsQuery.data.data.departments
    : [];
  const designations = designationsQuery.data?.success
    ? designationsQuery.data.data.designations
    : [];

  async function submit(values: DesignationFormValues) {
    setError(null);
    const response = await createDesignation(token, {
      title: values.title.trim(),
      description: values.description.trim() || null,
      departmentId: values.departmentId || null
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
    void designationsQuery.refetch();
  }

  async function removeDesignation(id: string, title: string) {
    if (!window.confirm(`Delete designation \"${title}\"?`)) {
      return;
    }

    setError(null);
    setDeletingDesignationId(id);

    const response = await deleteDesignation(token, id).catch(() => null);

    setDeletingDesignationId(null);

    if (!response) {
      setError("Unable to reach the API");
      return;
    }

    if (!response.success) {
      setError(getApiErrorMessage(response));
      return;
    }

    void designationsQuery.refetch();
  }

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-brand-700">Employees</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
            Designations
          </h1>
        </div>

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <form
            className="rounded-lg border border-line bg-white p-5 shadow-soft"
            onSubmit={handleSubmit(submit)}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-brand-50 text-brand-700">
                <BriefcaseBusiness size={20} aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold tracking-normal">Add Designation</h2>
            </div>

            {error ? (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Title
              <input
                className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm outline-none transition focus:border-brand-600"
                {...register("title", { required: true })}
              />
            </label>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Department
              <select
                className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-600"
                {...register("departmentId")}
              >
                <option value="">Unassigned</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Description
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-line px-3 py-3 text-sm outline-none transition focus:border-brand-600"
                {...register("description")}
              />
            </label>
            <button
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              <Plus size={17} aria-hidden="true" />
              Create designation
            </button>
          </form>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold tracking-normal">Designation List</h2>
            <div className="mt-5 overflow-hidden rounded-md border border-line">
              {designations.map((designation) => (
                <div
                  key={designation.id}
                  className="grid gap-3 border-b border-line px-4 py-4 last:border-0 sm:grid-cols-[1fr_auto] sm:items-start"
                >
                  <div>
                    <p className="font-medium text-ink">{designation.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {designation.department?.name ?? "Unassigned department"}
                    </p>
                    {designation.description ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {designation.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 self-start">
                    <span className="rounded-md bg-surface px-2 py-1 text-xs font-medium text-slate-600">
                      {designation._count?.employees ?? 0} employees
                    </span>
                    <button
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      onClick={() => removeDesignation(designation.id, designation.title)}
                      disabled={deletingDesignationId === designation.id}
                      aria-label={`Delete designation ${designation.title}`}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!designationsQuery.isLoading && designations.length === 0 ? (
              <p className="mt-5 rounded-md border border-dashed border-line px-4 py-5 text-sm text-slate-500">
                No designations found.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default function DesignationsPage() {
  return (
    <ProtectedPage requiredPermissions={["employees:manage"]}>
      {({ user, token }) => <DesignationsContent user={user} token={token} />}
    </ProtectedPage>
  );
}
