import type { QueryClient } from "@tanstack/react-query";
import {
  getAttendanceReport,
  getAttendanceReportData,
  getDashboardSummary,
  getEmployeeReport,
  getLeaveReportData,
  getMyAttendance,
  getMyEmployeeProfile,
  listDepartments,
  listDesignations,
  listEmployees,
  listHolidays,
  listLeaveBalances,
  listLeaveRequests,
  listLeaveTypes,
  listMyLeaves,
  listNotifications,
  listShifts
} from "@/lib/api";
import { getMonthStartInputValue, getTodayInputValue } from "@/lib/time-format";

function prefetchQuery(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  queryFn: () => Promise<unknown>
) {
  void queryClient.prefetchQuery({
    queryKey,
    queryFn
  });
}

export function prefetchNavData(
  queryClient: QueryClient,
  token: string,
  href: string
) {
  const dateFrom = getMonthStartInputValue();
  const dateTo = getTodayInputValue();
  const year = new Date().getFullYear();

  if (href === "/dashboard") {
    prefetchQuery(queryClient, ["dashboard-summary", token], () =>
      getDashboardSummary(token)
    );
    return;
  }

  if (href === "/reports") {
    prefetchQuery(queryClient, ["report-employees", token, dateFrom, dateTo], () =>
      getEmployeeReport(token, { dateFrom, dateTo })
    );
    prefetchQuery(queryClient, ["report-attendance", token, dateFrom, dateTo], () =>
      getAttendanceReportData(token, { dateFrom, dateTo })
    );
    prefetchQuery(queryClient, ["report-leaves", token, dateFrom, dateTo], () =>
      getLeaveReportData(token, { dateFrom, dateTo })
    );
    return;
  }

  if (href === "/notifications") {
    prefetchQuery(queryClient, ["notifications", token], () => listNotifications(token));
    return;
  }

  
  
  if (href === "/profile") {
    prefetchQuery(queryClient, ["my-employee-profile", token], () =>
      getMyEmployeeProfile(token)
    );
    return;
  }

  if (href === "/employees") {
    prefetchQuery(queryClient, ["employees", token, "", "", ""], () =>
      listEmployees(token, { search: "", status: "", departmentId: "" })
    );
    prefetchQuery(queryClient, ["departments", token], () => listDepartments(token));
    return;
  }

  if (href === "/departments") {
    prefetchQuery(queryClient, ["departments", token], () => listDepartments(token));
    return;
  }

  if (href === "/designations") {
    prefetchQuery(queryClient, ["departments", token], () => listDepartments(token));
    prefetchQuery(queryClient, ["designations", token], () => listDesignations(token));
    return;
  }

  if (href === "/attendance") {
    prefetchQuery(queryClient, ["my-attendance", token, dateFrom, dateTo], () =>
      getMyAttendance(token, { dateFrom, dateTo })
    );
    return;
  }

  if (href === "/attendance/report") {
    prefetchQuery(
      queryClient,
      ["attendance-report", token, dateFrom, dateTo, "", "", ""],
      () =>
        getAttendanceReport(token, {
          dateFrom,
          dateTo,
          employeeId: "",
          departmentId: "",
          status: ""
        })
    );
    prefetchQuery(queryClient, ["employees", token, "attendance-report"], () =>
      listEmployees(token, {})
    );
    prefetchQuery(queryClient, ["departments", token, "attendance-report"], () =>
      listDepartments(token)
    );
    return;
  }

  if (href === "/shifts") {
    prefetchQuery(queryClient, ["shifts", token], () => listShifts(token));
    return;
  }

  if (href === "/holidays") {
    prefetchQuery(queryClient, ["holidays", token, year], () =>
      listHolidays(token, year)
    );
    return;
  }

  if (href === "/leaves/apply") {
    prefetchQuery(queryClient, ["leave-types", token], () => listLeaveTypes(token));
    prefetchQuery(queryClient, ["leave-balances", token, year], () =>
      listLeaveBalances(token, { year })
    );
    return;
  }

  if (href === "/leaves/me") {
    prefetchQuery(queryClient, ["my-leaves", token], () => listMyLeaves(token));
    return;
  }

  if (href === "/leaves/approvals") {
    prefetchQuery(queryClient, ["leave-approvals", token, "", ""], () =>
      listLeaveRequests(token, { status: "", departmentId: "" })
    );
    prefetchQuery(queryClient, ["departments", token, "leave-approvals"], () =>
      listDepartments(token)
    );
    return;
  }

  if (href === "/leaves/balances") {
    prefetchQuery(queryClient, ["leave-balances", token, year], () =>
      listLeaveBalances(token, { year })
    );
    return;
  }

  if (href === "/leave-types") {
    prefetchQuery(queryClient, ["leave-types", token, "settings"], () =>
      listLeaveTypes(token)
    );
    return;
  }

}
