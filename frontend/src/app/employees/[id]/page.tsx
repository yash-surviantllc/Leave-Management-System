"use client";

import {
  BriefcaseBusiness,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  UserCircle
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtectedPage } from "@/components/protected-page";
import {
  getApiErrorMessage,
  getEmployee
} from "@/lib/api";
import {
  employmentStatusLabels,
  formatDate,
  getEmployeeName
} from "@/lib/employee-format";
import type { AuthUser, Employee } from "@/types";

type EmployeeProfileContentProps = {
  user: AuthUser;
  token: string;
};



function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function EmployeeProfile({ employee }: { employee: Employee }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-md bg-brand-50 text-brand-700">
            <UserCircle size={32} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal">
              {getEmployeeName(employee)}
            </h2>
            <p className="text-sm text-slate-500">{employee.employeeCode}</p>
          </div>
        </div>
        <div className="mt-6 space-y-3 text-sm">
          <div className="flex min-w-0 items-center gap-3 rounded-md bg-surface px-4 py-3">
            <Mail size={17} className="text-slate-500" aria-hidden="true" />
            <span>{employee.workEmail}</span>
          </div>
          <div className="flex min-w-0 items-center gap-3 rounded-md bg-surface px-4 py-3">
            <Phone size={17} className="text-slate-500" aria-hidden="true" />
            <span>{employee.phone ?? "Not set"}</span>
          </div>
          <div className="flex min-w-0 items-center gap-3 rounded-md bg-surface px-4 py-3">
            <ShieldCheck size={17} className="text-slate-500" aria-hidden="true" />
            <span>{employmentStatusLabels[employee.status]}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold tracking-normal">Employment</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DetailRow label="Department" value={employee.department?.name ?? "Unassigned"} />
          <DetailRow label="Designation" value={employee.designation?.title ?? "Unassigned"} />
          <DetailRow label="Manager" value={employee.manager ? getEmployeeName(employee.manager) : "Unassigned"} />
          <DetailRow label="Joining" value={formatDate(employee.dateOfJoining)} />
          <DetailRow label="Exit" value={formatDate(employee.dateOfExit)} />
          <DetailRow label="Location" value={employee.location ?? "Not set"} />
        </div>
      </div>
    </section>
  );
}

function EmployeeProfileContent({ user, token }: EmployeeProfileContentProps) {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const employeeQuery = useQuery({
    queryKey: ["employee", token, employeeId],
    queryFn: () => getEmployee(token, employeeId),
    retry: false
  });
  const employee = employeeQuery.data?.success
    ? employeeQuery.data.data.employee
    : null;

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-brand-700">Employees</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
              {employee ? getEmployeeName(employee) : "Employee Profile"}
            </h1>
          </div>
          {employee ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
              href={`/employees/${employee.id}/edit`}
            >
              <Pencil size={17} aria-hidden="true" />
              Edit employee
            </Link>
          ) : null}
        </div>

        {employeeQuery.isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-brand-50" />
        ) : null}

        {!employeeQuery.isLoading && !employee ? (
          <section className="rounded-lg border border-line bg-white p-6 text-sm text-slate-600 shadow-soft">
            Employee record could not be loaded.
          </section>
        ) : null}

        {employee ? (
          <>
            <EmployeeProfile employee={employee} />

            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
                <h2 className="text-lg font-semibold tracking-normal">
                  Emergency Contacts
                </h2>
                <div className="mt-5 space-y-3">
                  {employee.emergencyContacts.map((contact) => (
                    <div key={contact.id} className="rounded-md bg-surface px-4 py-3">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <p className="font-medium text-ink">{contact.name}</p>
                        {contact.isPrimary ? (
                          <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                            Primary
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {contact.relationship} | {contact.phone}
                      </p>
                    </div>
                  ))}
                  {employee.emergencyContacts.length === 0 ? (
                    <p className="rounded-md border border-dashed border-line px-4 py-5 text-sm text-slate-500">
                      No emergency contacts.
                    </p>
                  ) : null}
                </div>
              </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function EmployeeProfilePage() {
  return (
    <ProtectedPage requiredPermissions={["employees:manage"]}>
      {({ user, token }) => <EmployeeProfileContent user={user} token={token} />}
    </ProtectedPage>
  );
}
