import type { Request } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { emitNotificationCreated, emitNotificationRead } from "../../lib/realtime";
import { authenticate } from "../../middleware/authenticate";
import { requireAnyPermission, requirePermissions } from "../../middleware/authorize";
import { AppError } from "../../middleware/error-handler";
import { ok } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  getPagination,
  getPaginationMeta,
  paginationQuerySchema
} from "../../utils/pagination";

export const notificationsRouter = Router();

const uuidSchema = z.string().uuid();
const paramsSchema = z.object({
  id: uuidSchema
});


function parseInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Request input is invalid", result.error.flatten());
  }

  return result.data;
}

function getAuth(req: Request) {
  if (!req.auth) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "A valid access token is required");
  }

  return req.auth;
}

notificationsRouter.use(authenticate);

notificationsRouter.get(
  "/notifications",
  requirePermissions(["notifications:read"]),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const query = parseInput(paginationQuerySchema, req.query);
    const pagination = getPagination(query);
    const where: Prisma.NotificationWhereInput = {
      userId: auth.id
    };
    const [total, unreadCount, notifications] = await prisma.$transaction([
      prisma.notification.count({
        where
      }),
      prisma.notification.count({
        where: {
          ...where,
          isRead: false
        }
      }),
      prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: "desc"
        },
        skip: pagination.skip,
        take: pagination.take
      })
    ]);

    res.status(200).json(ok({ notifications, unreadCount }, getPaginationMeta({ total, pagination })));
  })
);

notificationsRouter.put(
  "/notifications/:id/read",
  requirePermissions(["notifications:read"]),
  asyncHandler(async (req, res) => {
    const auth = getAuth(req);
    const params = parseInput(paramsSchema, req.params);
    const notification = await prisma.notification.findFirst({
      where: {
        id: params.id,
        userId: auth.id
      }
    });

    if (!notification) {
      throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found");
    }

    const wasUnread = !notification.isRead;
    const updatedNotification = await prisma.notification.update({
      where: {
        id: notification.id
      },
      data: {
        isRead: true,
        readAt: notification.readAt ?? new Date()
      }
    });
    const unreadCount = await prisma.notification.count({
      where: {
        userId: auth.id,
        isRead: false
      }
    });

    try {
      await emitNotificationRead({
        notification: updatedNotification,
        wasUnread
      });
    } catch (error) {
      console.warn("Notification read realtime sync failed", {
        error: error instanceof Error ? error.message : String(error),
        notificationId: updatedNotification.id,
        userId: auth.id
      });
    }

    res.status(200).json(ok({ notification: updatedNotification, unreadCount }));
  })
);


