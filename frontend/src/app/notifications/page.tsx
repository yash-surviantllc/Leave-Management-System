"use client";

import { Bell, Check, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { ProtectedPage } from "@/components/protected-page";
import {
  getApiErrorMessage,
  getPaginationMeta,
  listNotifications,
  markNotificationRead
} from "@/lib/api";
import {
  markNotificationReadInCache,
  replaceNotificationInCache,
  restoreQuerySnapshots,
  snapshotNotificationState,
  syncNotificationUnreadCountInCache
} from "@/lib/optimistic-cache";
import { formatDateTime } from "@/lib/time-format";
import type { AuthUser, NotificationRecord } from "@/types";

type NotificationsContentProps = {
  user: AuthUser;
  token: string;
};

const pageSize = 25;

function NotificationsContent({ user, token }: NotificationsContentProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const markingNotificationIdsRef = useRef<Set<string>>(new Set());
  const [markingNotificationIds, setMarkingNotificationIds] = useState<Set<string>>(
    () => new Set()
  );
  const [page, setPage] = useState(1);
  const notificationsQuery = useQuery({
    queryKey: ["notifications", token, page],
    queryFn: () => listNotifications(token, { page, pageSize }),
    retry: false
  });
  const notifications = notificationsQuery.data?.success
    ? notificationsQuery.data.data.notifications
    : [];
  const unreadCount = notificationsQuery.data?.success
    ? notificationsQuery.data.data.unreadCount
    : 0;
  const pagination = useMemo(
    () => (notificationsQuery.data ? getPaginationMeta(notificationsQuery.data) : null),
    [notificationsQuery.data]
  );

  function setNotificationMarking(notificationId: string, isMarking: boolean) {
    const next = new Set(markingNotificationIdsRef.current);

    if (isMarking) {
      next.add(notificationId);
    } else {
      next.delete(notificationId);
    }

    markingNotificationIdsRef.current = next;
    setMarkingNotificationIds(next);
  }

  async function markRead(notification: NotificationRecord) {
    if (
      notification.isRead ||
      markingNotificationIdsRef.current.has(notification.id)
    ) {
      return;
    }

    setError(null);
    setNotificationMarking(notification.id, true);

    const snapshots = snapshotNotificationState(queryClient, token);
    markNotificationReadInCache(
      queryClient,
      token,
      notification.id,
      new Date().toISOString()
    );
    const response = await markNotificationRead(token, notification.id).catch(() => null);

    setNotificationMarking(notification.id, false);

    if (!response) {
      restoreQuerySnapshots(queryClient, snapshots);
      setError("Unable to reach the API");
      return;
    }

    if (!response.success) {
      restoreQuerySnapshots(queryClient, snapshots);
      setError(getApiErrorMessage(response));
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
      <div className="space-y-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-brand-50 text-brand-700">
            <Bell size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-700">Notifications</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-ink">
              In-app Alerts
            </h1>
          </div>
        </div>

        <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold tracking-normal">
              {unreadCount} unread
            </h2>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>
          <div className="mt-5 divide-y divide-line">
            {notifications.map((notification) => {
              const isMarking = markingNotificationIds.has(notification.id);

              return (
                <div
                  key={notification.id}
                  className={`grid gap-4 py-4 transition-colors duration-150 sm:grid-cols-[1fr_auto] ${
                    notification.isRead ? "text-slate-600" : "text-ink"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{notification.title}</p>
                      {!notification.isRead ? (
                        <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                          New
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDateTime(notification.createdAt)}
                    </p>
                  </div>
                  <button
                    className={`inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${
                      notification.isRead
                        ? "bg-surface text-slate-500"
                        : "bg-white text-slate-700 hover:-translate-y-0.5 hover:bg-surface"
                    } ${isMarking ? "scale-[0.98]" : ""}`}
                    type="button"
                    onClick={() => void markRead(notification)}
                    disabled={notification.isRead || isMarking}
                    aria-label="Mark notification as read"
                    aria-busy={isMarking}
                  >
                    {isMarking ? (
                      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                    ) : (
                      <Check size={16} aria-hidden="true" />
                    )}
                    <span>
                      {isMarking
                        ? "Saving..."
                        : notification.isRead
                          ? "Read"
                          : "Mark as read"}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          {!notificationsQuery.isLoading && notifications.length === 0 ? (
            <div className="mt-5 rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-slate-500">
              No notifications found.
            </div>
          ) : null}
          <PaginationControls
            pagination={pagination}
            onPageChange={setPage}
            isFetching={notificationsQuery.isFetching}
          />
        </section>
      </div>
    </AppShell>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedPage requiredPermissions={["notifications:read"]}>
      {({ user, token }) => <NotificationsContent user={user} token={token} />}
    </ProtectedPage>
  );
}
