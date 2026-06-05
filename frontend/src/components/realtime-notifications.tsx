"use client";

import { useEffect } from "react";
import {
  useQueryClient,
  type QueryClient,
  type QueryKey
} from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl, type ApiResponse } from "@/lib/api";
import type { DashboardSummary, NotificationRecord } from "@/types";

type RealtimeNotificationsProps = {
  token: string;
};

type NotificationsResponse = {
  notifications: NotificationRecord[];
  unreadCount: number;
};

type NotificationEvent = {
  notification: NotificationRecord;
  unreadDelta: number;
};

type ServerToClientEvents = {
  "notifications:ready": (payload: { userId: string }) => void;
  "notifications:created": (payload: NotificationEvent) => void;
  "notifications:read": (payload: NotificationEvent) => void;
};

type ClientToServerEvents = Record<string, never>;

const notificationsPageSize = 25;
const dashboardNotificationLimit = 5;
const announcementNotificationCategoryPrefix = "announcement:";

function getRealtimeUrl(): string {
  const apiUrl = getApiBaseUrl();

  return apiUrl.endsWith("/api") ? apiUrl.slice(0, -4) : apiUrl;
}

function nextUnreadCount(currentCount: number, unreadDelta: number): number {
  return Math.max(0, currentCount + unreadDelta);
}

function isAnnouncementNotification(notification: NotificationRecord): boolean {
  return (
    typeof notification.category === "string" &&
    notification.category.startsWith(announcementNotificationCategoryPrefix)
  );
}

function notificationExists(
  notifications: NotificationRecord[],
  notificationId: string
): boolean {
  return notifications.some((notification) => notification.id === notificationId);
}

function upsertNotification(
  notifications: NotificationRecord[],
  notification: NotificationRecord
): NotificationRecord[] {
  if (!notificationExists(notifications, notification.id)) {
    return [notification, ...notifications];
  }

  return notifications.map((currentNotification) =>
    currentNotification.id === notification.id ? notification : currentNotification
  );
}

function updateNotificationsCache(
  queryClient: QueryClient,
  token: string,
  updater: (
    current: ApiResponse<NotificationsResponse> | undefined,
    queryKey: QueryKey
  ) => ApiResponse<NotificationsResponse> | undefined
): void {
  const queries = queryClient.getQueryCache().findAll({
    queryKey: ["notifications", token],
    exact: false
  });

  queries.forEach((query) => {
    queryClient.setQueryData<ApiResponse<NotificationsResponse>>(
      query.queryKey,
      (current) => updater(current, query.queryKey)
    );
  });
}

function isNotificationReadInCache(
  queryClient: QueryClient,
  token: string,
  notificationId: string
): boolean {
  const notificationQueries = queryClient.getQueryCache().findAll({
    queryKey: ["notifications", token],
    exact: false
  });

  const isReadInNotificationCache = notificationQueries.some((query) => {
    const current = queryClient.getQueryData<ApiResponse<NotificationsResponse>>(
      query.queryKey
    );

    return Boolean(
      current?.success &&
        current.data.notifications.some(
          (notification) => notification.id === notificationId && notification.isRead
        )
    );
  });

  if (isReadInNotificationCache) {
    return true;
  }

  const dashboardSummary = queryClient.getQueryData<ApiResponse<DashboardSummary>>([
    "dashboard-summary",
    token
  ]);

  return Boolean(
    dashboardSummary?.success &&
      dashboardSummary.data.notifications.some(
        (notification) => notification.id === notificationId && notification.isRead
      )
  );
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

function syncCreatedNotification(
  queryClient: QueryClient,
  token: string,
  event: NotificationEvent
): void {
  updateNotificationsCache(queryClient, token, (current, queryKey) => {
    if (!current?.success) {
      return current;
    }

    const page = typeof queryKey[2] === "number" ? queryKey[2] : 1;
    const hasNotification = notificationExists(
      current.data.notifications,
      event.notification.id
    );
    const notifications =
      page === 1
        ? upsertNotification(current.data.notifications, event.notification).slice(
            0,
            notificationsPageSize
          )
        : current.data.notifications;

    return {
      ...current,
      data: {
        ...current.data,
        notifications,
        unreadCount: nextUnreadCount(
          current.data.unreadCount,
          hasNotification ? 0 : event.unreadDelta
        )
      }
    };
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
            notifications: isAnnouncementNotification(event.notification)
              ? current.data.notifications
              : upsertNotification(
                  current.data.notifications,
                  event.notification
                ).slice(0, dashboardNotificationLimit)
          },
          event.unreadDelta
        )
      };
    }
  );

  void queryClient.invalidateQueries({
    queryKey: ["notifications", token],
    exact: false
  });
  void queryClient.invalidateQueries({
    queryKey: ["dashboard-summary", token],
    exact: true
  });
  void queryClient.invalidateQueries({
    queryKey: ["announcements", token],
    exact: false
  });
}

function syncReadNotification(
  queryClient: QueryClient,
  token: string,
  event: NotificationEvent
): void {
  const unreadDelta = isNotificationReadInCache(
    queryClient,
    token,
    event.notification.id
  )
    ? 0
    : event.unreadDelta;

  updateNotificationsCache(queryClient, token, (current) => {
    if (!current?.success) {
      return current;
    }

    return {
      ...current,
      data: {
        ...current.data,
        notifications: current.data.notifications.map((notification) =>
          notification.id === event.notification.id ? event.notification : notification
        ),
        unreadCount: nextUnreadCount(current.data.unreadCount, unreadDelta)
      }
    };
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
              notification.id === event.notification.id
                ? event.notification
                : notification
            )
          },
          unreadDelta
        )
      };
    }
  );

  void queryClient.invalidateQueries({
    queryKey: ["notifications", token],
    exact: false
  });
  void queryClient.invalidateQueries({
    queryKey: ["dashboard-summary", token],
    exact: true
  });
}

function syncRealtimeReady(queryClient: QueryClient, token: string): void {
  void queryClient.invalidateQueries({
    queryKey: ["notifications", token],
    exact: false
  });
  void queryClient.invalidateQueries({
    queryKey: ["dashboard-summary", token],
    exact: true
  });
  void queryClient.invalidateQueries({
    queryKey: ["announcements", token],
    exact: false
  });
}

export function RealtimeNotifications({ token }: RealtimeNotificationsProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      getRealtimeUrl(),
      {
        auth: {
          token
        },
        transports: ["websocket", "polling"],
        withCredentials: true
      }
    );

    function handleNotificationCreated(event: NotificationEvent) {
      syncCreatedNotification(queryClient, token, event);
    }

    function handleNotificationRead(event: NotificationEvent) {
      syncReadNotification(queryClient, token, event);
    }

    function handleRealtimeReady() {
      syncRealtimeReady(queryClient, token);
    }

    socket.on("notifications:ready", handleRealtimeReady);
    socket.on("notifications:created", handleNotificationCreated);
    socket.on("notifications:read", handleNotificationRead);

    return () => {
      socket.off("notifications:ready", handleRealtimeReady);
      socket.off("notifications:created", handleNotificationCreated);
      socket.off("notifications:read", handleNotificationRead);
      socket.disconnect();
    };
  }, [queryClient, token]);

  return null;
}
