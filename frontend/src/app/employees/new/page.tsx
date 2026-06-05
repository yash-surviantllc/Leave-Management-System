"use client";

import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EmployeeForm,
  emptyEmployeeFormValues
} from "@/components/employee-form";
import { AppShell } from "@/components/app-shell";
import { ProtectedPage } from "@/components/protected-page";
import {
  createEmployee,
  getApiErrorMessage,
  listDepartments,
  listDesignations,
  listEmployees
} from "@/lib/api";
import type { EmployeeInput } from "@/lib/api";
import type { AuthUser } from "@/types";

type NewEmployeeContentProps = {
  user: AuthUser;
  token: string;
};

function NewEmployeeContent({ user, token }: NewEmployeeContentProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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
  const employeesQuery = useQuery({
    queryKey: ["employees", token, "managers"],
    queryFn: () => listEmployees(token, {}),
    retry: false
  });
  const departments = departmentsQuery.data?.success
    ? departmentsQuery.data.data.departments
    : [];
  const designations = designationsQuery.data?.success
    ? designationsQuery.data.data.designations
    : [];
  const managers = employeesQuery.data?.success
    ? employeesQuery.data.data.employees
    : [];

  async function submit(input: EmployeeInput) {
    setError(null);
    const response = await createEmployee(token, input).catch(() => null);

    if (!response) {
      setError("Unable to reach the API");
      return;
    }

    if (!response.success) {
      setError(getApiErrorMessage(response));
      return;
    }

    router.push(`/employees/${response.data.employee.id}`);
  }

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-50 text-brand-700">
            <UserPlus size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-700">Employees</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
              Add Employee
            </h1>
          </div>
        </div>

        <EmployeeForm
          departments={departments}
          designations={designations}
          managers={managers}
          initialValues={emptyEmployeeFormValues}
          submitLabel="Create employee"
          cancelHref="/employees"
          error={error}
          onSubmit={submit}
        />
      </div>
    </AppShell>
  );
}

export default function NewEmployeePage() {
  return (
    <ProtectedPage requiredPermissions={["employees:manage"]}>
      {({ user, token }) => <NewEmployeeContent user={user} token={token} />}
    </ProtectedPage>
  );
}
