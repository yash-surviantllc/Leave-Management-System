"use client";

import {
  AlertCircle,
  Bell,
  CalendarDays,
  Check,
  IndianRupee,
  Loader2,
  RefreshCw,
  TrendingDown,
  UserPlus,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtectedPage } from "@/components/protected-page";
import { getApiErrorMessage, getDashboardSummary, markNotificationRead } from "@/lib/api";
import {
  markNotificationReadInCache,
  replaceNotificationInCache,
  restoreQuerySnapshots,
  snapshotNotificationState,
  syncNotificationUnreadCountInCache
} from "@/lib/optimistic-cache";
import { formatDate } from "@/lib/employee-format";
import { formatDateTime } from "@/lib/time-format";
import type { AuthUser, DashboardCard } from "@/types";

type DashboardContentProps = {
  user: AuthUser;
  token: string;
};

const cardIcons: Record<string, LucideIcon> = {
  employees: Users,
  present_today: Users,
  on_leave: CalendarDays,
  pending_leaves: AlertCircle,
  new_hires: UserPlus,
  attrition_rate: TrendingDown,
  unread_notifications: Bell
};

const metricToneClasses: Record<DashboardCard["tone"], string> = {
  brand: "text-emerald-600",
  blue: "text-sky-600",
  amber: "text-amber-600",
  slate: "text-slate-500"
};

const metricIconClasses: Record<DashboardCard["tone"], string> = {
  brand: "bg-emerald-50 text-emerald-700",
  blue: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-700"
};

function getCardValue(card: DashboardCard): string {

  return card.value;
}

function getCurrentDateLabel(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short"
  }).format(new Date());
}

function getUserFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function DashboardContent({ user, token }: DashboardContentProps) {
  const queryClient = useQueryClient();
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isRefreshingDashboard, setIsRefreshingDashboard] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null);
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", token],
    queryFn: () => getDashboardSummary(token),
    retry: false
  });
  const summary = summaryQuery.data?.success ? summaryQuery.data.data : null;
  const cards = summary?.cards ?? [];
  const notifications = summary?.notifications ?? [];
  const summaryError =
    summaryQuery.data && !summaryQuery.data.success
      ? getApiErrorMessage(summaryQuery.data)
      : summaryQuery.isError
        ? "Unable to reach the API. Check the deployed backend URL and Render service status."
        : null;
  const scopeLabel =
    summary?.scope === "organization" ? "Organization" : "Self-service";

  async function refreshDashboard() {
    setDashboardError(null);
    setIsRefreshingDashboard(true);

    const response = await getDashboardSummary(token, { refresh: true }).catch(() => null);

    setIsRefreshingDashboard(false);

    if (!response) {
      setDashboardError("Unable to reach the API");
      return;
    }

    if (!response.success) {
      setDashboardError(getApiErrorMessage(response));
      return;
    }

    queryClient.setQueryData(["dashboard-summary", token], response);
    void queryClient.invalidateQueries({
      queryKey: ["notifications", token],
      exact: false
    });
  }

  async function markDashboardNotificationRead(id: string) {
    setNotificationError(null);
    setMarkingNotificationId(id);

    const snapshots = snapshotNotificationState(queryClient, token);
    markNotificationReadInCache(
      queryClient,
      token,
      id,
      new Date().toISOString()
    );

    const response = await markNotificationRead(token, id).catch(() => null);

    setMarkingNotificationId(null);

    if (!response) {
      restoreQuerySnapshots(queryClient, snapshots);
      setNotificationError("Unable to reach the API");
      return;
    }

    if (!response.success) {
      restoreQuerySnapshots(queryClient, snapshots);
      setNotificationError(getApiErrorMessage(response));
      return;
    }

    replaceNotificationInCache(queryClient, token, response.data.notification);
    if (Number.isFinite(response.data.unreadCount)) {
      syncNotificationUnreadCountInCache(
        queryClient,
        token,
        response.data.unreadCount
      );
    }
    void queryClient.invalidateQueries({
      queryKey: ["notifications", token],
      exact: false
    });
    void queryClient.invalidateQueries({
      queryKey: ["dashboard-summary", token],
      exact: true
    });
  }

  return (
    <AppShell user={user} token={token}>
      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-5 py-5 md:flex-row md:items-start">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
                Hey, {getUserFirstName(user.name)}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Quickly access all information about you, your team, and your members
              </p>
            </div>
            <div className="inline-flex h-9 items-center gap-2 self-start rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)] md:self-auto">
              <CalendarDays size={16} aria-hidden="true" />
              {getCurrentDateLabel()}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase text-slate-400">
            <span className="rounded-md px-2 py-1">Personal</span>
            <span className="rounded-md bg-[#020617] px-2 py-1 text-white">
              {scopeLabel}
            </span>
            <span className="rounded-md px-2 py-1">Managed by me</span>
            <button
              className="ml-auto grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={refreshDashboard}
              disabled={isRefreshingDashboard}
              aria-label="Refresh dashboard"
              aria-busy={isRefreshingDashboard}
            >
              <RefreshCw
                className={isRefreshingDashboard ? "animate-spin" : undefined}
                size={16}
                aria-hidden="true"
              />
            </button>
          </div>

          <section className="grid sm:grid-cols-2 xl:grid-cols-4">
            {summaryError ? (
              <div className="col-span-full border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
                {summaryError}
              </div>
            ) : null}
            {dashboardError ? (
              <div className="col-span-full border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
                {dashboardError}
              </div>
            ) : null}
            {cards.map((card) => {
              const Icon = cardIcons[card.key] ?? Users;

              return (
                <article
                  className="border-b border-slate-200 px-5 py-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
                  key={card.key}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {card.label}
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
                        {getCardValue(card)}
                      </p>
                    </div>
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-md ${metricIconClasses[card.tone]}`}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </div>
                  </div>
                  <p className={`mt-2 text-xs font-medium ${metricToneClasses[card.tone]}`}>
                    {card.detail}
                  </p>
                </article>
              );
            })}

            {summaryQuery.isLoading && cards.length === 0 ? (
              <div className="col-span-full px-5 py-12 text-center text-sm text-slate-500">
                Loading dashboard summary...
              </div>
            ) : null}
          </section>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.04)]">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                  Notifications
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Recent alerts and workflow updates
                </p>
                {notificationError ? (
                  <p className="mt-2 text-xs text-red-700">{notificationError}</p>
                ) : null}
              </div>
              <Link
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                href="/notifications"
              >
                View all
              </Link>
            </div>

            <div className="divide-y divide-slate-100 px-5">
              {notifications.map((notification) => {
                const isMarking = markingNotificationId === notification.id;

                return (
                <div key={notification.id} className="flex min-w-0 gap-3 py-4">
                  <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700">
                    <Bell size={17} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <p className="font-semibold text-slate-950">{notification.title}</p>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-xs text-slate-400">
                          {formatDateTime(notification.createdAt)}
                        </span>
                        <button
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 transition active:scale-[0.98] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          onClick={() => markDashboardNotificationRead(notification.id)}
                          disabled={notification.isRead || isMarking}
                          aria-busy={isMarking}
                        >
                          {isMarking ? (
                            <Loader2 className="animate-spin" size={14} aria-hidden="true" />
                          ) : (
                            <Check size={14} aria-hidden="true" />
                          )}
                          {isMarking
                            ? "Saving..."
                            : notification.isRead
                              ? "Read"
                              : "Mark as read"}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {notification.message}
                    </p>
                  </div>
                </div>
                );
              })}
            </div>
            {!summaryQuery.isLoading && notifications.length === 0 ? (
              <div className="m-5 rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No notifications found.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedPage requiredPermissions={["dashboard:read"]}>
      {({ user, token }) => <DashboardContent user={user} token={token} />}
    </ProtectedPage>
  );
}
