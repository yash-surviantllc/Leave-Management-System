"use client";

import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  EmployeeForm,
  type EmployeeFormValues
} from "@/components/employee-form";
import { ProtectedPage } from "@/components/protected-page";
import {
  getApiErrorMessage,
  getEmployee,
  listDepartments,
  listDesignations,
  listEmployees,
  updateEmployee
} from "@/lib/api";
import type { EmployeeInput } from "@/lib/api";
import { getEmployeeName, toDateInputValue } from "@/lib/employee-format";
import type { AuthUser, Employee } from "@/types";

type EditEmployeeContentProps = {
  user: AuthUser;
  token: string;
};

function toFormValues(employee: Employee): EmployeeFormValues {
  const emergencyContact = employee.emergencyContacts[0];

  return {
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    workEmail: employee.workEmail,
    personalEmail: employee.personalEmail ?? "",
    phone: employee.phone ?? "",
    dateOfBirth: toDateInputValue(employee.dateOfBirth),
    dateOfJoining: toDateInputValue(employee.dateOfJoining),
    dateOfExit: toDateInputValue(employee.dateOfExit),
    status: employee.status,
    location: employee.location ?? "",
    departmentId: employee.departmentId ?? "",
    designationId: employee.designationId ?? "",
    managerId: employee.managerId ?? "",
    emergencyContactName: emergencyContact?.name ?? "",
    emergencyContactRelationship: emergencyContact?.relationship ?? "",
    emergencyContactPhone: emergencyContact?.phone ?? "",
    emergencyContactEmail: emergencyContact?.email ?? ""
  };
}

function EditEmployeeContent({ user, token }: EditEmployeeContentProps) {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const employeeQuery = useQuery({
    queryKey: ["employee", token, employeeId],
    queryFn: () => getEmployee(token, employeeId),
    retry: false
  });
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
  const employee = employeeQuery.data?.success
    ? employeeQuery.data.data.employee
    : null;
  const departments = departmentsQuery.data?.success
    ? departmentsQuery.data.data.departments
    : [];
  const designations = designationsQuery.data?.success
    ? designationsQuery.data.data.designations
    : [];
  const managers = employeesQuery.data?.success
    ? employeesQuery.data.data.employees.filter((manager) => manager.id !== employeeId)
    : [];
  const initialValues = useMemo(() => {
    if (!employee) {
      return null;
    }

    return toFormValues(employee);
  }, [employee]);

  async function submit(input: EmployeeInput) {
    setError(null);
    const response = await updateEmployee(token, employeeId, input).catch(() => null);

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
            <Pencil size={21} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-700">Employees</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
              {employee ? `Edit ${getEmployeeName(employee)}` : "Edit Employee"}
            </h1>
          </div>
        </div>

        {!initialValues ? (
          <div className="h-24 animate-pulse rounded-lg bg-brand-50" />
        ) : (
          <EmployeeForm
            departments={departments}
            designations={designations}
            managers={managers}
            initialValues={initialValues}
            submitLabel="Save changes"
            cancelHref={`/employees/${employeeId}`}
            error={error}
            onSubmit={submit}
          />
        )}
      </div>
    </AppShell>
  );
}

export default function EditEmployeePage() {
  return (
    <ProtectedPage requiredPermissions={["employees:manage"]}>
      {({ user, token }) => <EditEmployeeContent user={user} token={token} />}
    </ProtectedPage>
  );
}
