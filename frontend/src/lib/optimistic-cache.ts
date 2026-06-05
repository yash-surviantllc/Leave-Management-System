import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ApiResponse } from "@/lib/api";
import type { DashboardSummary, NotificationRecord } from "@/types";

type NotificationsResponse = {
  notifications: NotificationRecord[];
  unreadCount: number;
};


export type QuerySnapshot = {
  queryKey: QueryKey;
  data: unknown;
};

export const notificationUnreadCountEventName = "lms:notification-unread-count";

export type NotificationUnreadCountEventDetail = {
  token: string;
  unreadCount: number;
};


function nextUnreadCount(currentCount: number, unreadDelta: number): number {
  return Math.max(0, currentCount + unreadDelta);
}

function applyDashboardUnreadDelta(
  summary: DashboardSummary,
  unreadDelta: number
): DashboardSummary {
  return {
    ...summary,
    cards: summary.cards.map((card) => {
      if (card.key !== "unread_notifications") {
        return card;
      }

      const currentValue = Number(card.value);

      if (!Number.isFinite(currentValue)) {
        return card;
      }

      return {
        ...card,
        value: String(nextUnreadCount(currentValue, unreadDelta))
      };
    })
  };
}

function setDashboardUnreadCount(
  summary: DashboardSummary,
  unreadCount: number
): DashboardSummary {
  return {
    ...summary,
    cards: summary.cards.map((card) => {
      if (card.key !== "unread_notifications") {
        return card;
      }

      return {
        ...card,
        value: String(Math.max(0, unreadCount))
      };
    })
  };
}

function markNotificationRead(
  notification: NotificationRecord,
  notificationId: string,
  readAt: string
): NotificationRecord {
  if (notification.id !== notificationId) {
    return notification;
  }

  return {
    ...notification,
    isRead: true,
    readAt
  };
}

function replaceNotification(
  notifications: NotificationRecord[],
  notification: NotificationRecord
): NotificationRecord[] {
  return notifications.map((currentNotification) =>
    currentNotification.id === notification.id ? notification : currentNotification
  );
}

function hasUnreadNotification(
  notifications: NotificationRecord[],
  notificationId: string
): boolean {
  return notifications.some(
    (notification) => notification.id === notificationId && !notification.isRead
  );
}

function getCachedReadDelta(
  queryClient: QueryClient,
  token: string,
  notificationId: string
): number {
  const notificationQueries = queryClient.getQueryCache().findAll({
    queryKey: ["notifications", token],
    exact: false
  });
  const hasUnreadInNotificationCache = notificationQueries.some((query) => {
    const current = queryClient.getQueryData<ApiResponse<NotificationsResponse>>(
      query.queryKey
    );

    return Boolean(
      current?.success &&
        hasUnreadNotification(current.data.notifications, notificationId)
    );
  });

  if (hasUnreadInNotificationCache) {
    return -1;
  }

  const dashboardSummary = queryClient.getQueryData<ApiResponse<DashboardSummary>>([
    "dashboard-summary",
    token
  ]);

  return dashboardSummary?.success &&
    hasUnreadNotification(dashboardSummary.data.notifications, notificationId)
    ? -1
    : 0;
}


function publishNotificationUnreadCount(token: string, unreadCount: number): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<NotificationUnreadCountEventDetail>(
      notificationUnreadCountEventName,
      {
        detail: {
          token,
          unreadCount
        }
      }
    )
  );
}

function getRestoredNotificationUnreadCount(
  snapshots: QuerySnapshot[]
): NotificationUnreadCountEventDetail | null {
  for (const snapshot of snapshots) {
    const [resource, token] = snapshot.queryKey;

    if (resource !== "notifications" || typeof token !== "string") {
      continue;
    }

    const data = snapshot.data as
      | { success?: unknown; data?: { unreadCount?: unknown } }
      | null
      | undefined;

    const unreadCount = data?.data?.unreadCount;

    if (data?.success !== true || !Number.isFinite(unreadCount)) {
      continue;
    }

    return {
      token,
      unreadCount: Number(unreadCount)
    };
  }

  return null;
}

export function snapshotNotificationState(
  queryClient: QueryClient,
  token: string
): QuerySnapshot[] {
  const notificationQueries = queryClient.getQueryCache().findAll({
    queryKey: ["notifications", token],
    exact: false
  });
  const dashboardQueries = queryClient.getQueryCache().findAll({
    queryKey: ["dashboard-summary", token],
    exact: true
  });

  return [...notificationQueries, ...dashboardQueries].map((query) => ({
    queryKey: query.queryKey,
    data: queryClient.getQueryData(query.queryKey)
  }));
}

export function restoreQuerySnapshots(
  queryClient: QueryClient,
  snapshots: QuerySnapshot[]
): void {
  snapshots.forEach((snapshot) => {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data);
  });

  const restoredUnreadCount = getRestoredNotificationUnreadCount(snapshots);

  if (restoredUnreadCount) {
    publishNotificationUnreadCount(
      restoredUnreadCount.token,
      restoredUnreadCount.unreadCount
    );
  }
}

export function markNotificationReadInCache(
  queryClient: QueryClient,
  token: string,
  notificationId: string,
  readAt: string
): void {
  const unreadDelta = getCachedReadDelta(queryClient, token, notificationId);
  const notificationQueries = queryClient.getQueryCache().findAll({
    queryKey: ["notifications", token],
    exact: false
  });
  let optimisticUnreadCount: number | null = null;

  notificationQueries.forEach((query) => {
    queryClient.setQueryData<ApiResponse<NotificationsResponse>>(
      query.queryKey,
      (current) => {
        if (!current?.success) {
          return current;
        }

        const unreadCount = nextUnreadCount(current.data.unreadCount, unreadDelta);

        optimisticUnreadCount ??= unreadCount;

        return {
          ...current,
          data: {
            ...current.data,
            notifications: current.data.notifications.map((notification) =>
              markNotificationRead(notification, notificationId, readAt)
            ),
            unreadCount
          }
        };
      }
    );
  });

  queryClient.setQueryData<ApiResponse<DashboardSummary>>(
    ["dashboard-summary", token],
    (current) => {
      if (!current?.success) {
        return current;
      }

      return {
        ...current,
        data: applyDashboardUnreadDelta(
          {
            ...current.data,
            notifications: current.data.notifications.map((notification) =>
              markNotificationRead(notification, notificationId, readAt)
            )
          },
          unreadDelta
        )
      };
    }
  );

  if (optimisticUnreadCount !== null) {
    publishNotificationUnreadCount(token, optimisticUnreadCount);
  }
}

export function replaceNotificationInCache(
  queryClient: QueryClient,
  token: string,
  notification: NotificationRecord
): void {
  const notificationQueries = queryClient.getQueryCache().findAll({
    queryKey: ["notifications", token],
    exact: false
  });

  notificationQueries.forEach((query) => {
    queryClient.setQueryData<ApiResponse<NotificationsResponse>>(
      query.queryKey,
      (current) => {
        if (!current?.success) {
          return current;
        }

        return {
          ...current,
          data: {
            ...current.data,
            notifications: replaceNotification(current.data.notifications, notification)
          }
        };
      }
    );
  });

  queryClient.setQueryData<ApiResponse<DashboardSummary>>(
    ["dashboard-summary", token],
    (current) => {
      if (!current?.success) {
        return current;
      }

      return {
        ...current,
        data: {
          ...current.data,
          notifications: replaceNotification(current.data.notifications, notification)
        }
      };
    }
  );
}

export function syncNotificationUnreadCountInCache(
  queryClient: QueryClient,
  token: string,
  unreadCount: number
): void {
  const nextUnreadCount = Number.isFinite(unreadCount)
    ? Math.max(0, unreadCount)
    : 0;
  const notificationQueries = queryClient.getQueryCache().findAll({
    queryKey: ["notifications", token],
    exact: false
  });

  notificationQueries.forEach((query) => {
    queryClient.setQueryData<ApiResponse<NotificationsResponse>>(
      query.queryKey,
      (current) => {
        if (!current?.success) {
          return current;
        }

        return {
          ...current,
          data: {
            ...current.data,
            unreadCount: nextUnreadCount
          }
        };
      }
    );
  });

  queryClient.setQueryData<ApiResponse<DashboardSummary>>(
    ["dashboard-summary", token],
    (current) => {
      if (!current?.success) {
        return current;
      }

      return {
        ...current,
        data: setDashboardUnreadCount(current.data, nextUnreadCount)
      };
    }
  );

  publishNotificationUnreadCount(token, nextUnreadCount);
}


