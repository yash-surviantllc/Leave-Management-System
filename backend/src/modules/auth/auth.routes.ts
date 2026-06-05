import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/authenticate";
import { AppError } from "../../middleware/error-handler";
import { ok } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { linkExistingEmployeeForUser } from "../employees/onboarding";
import {
  createPasswordResetToken,
  getAuthUserById,
  getPasswordResetExpiry,
  hashPasswordResetToken
} from "./auth.service";
import { signAccessToken } from "./jwt";
import { hashPassword, verifyPassword } from "./password";

export const authRouter = Router();

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const emailSchema = z
  .string()
  .trim()
  .email("Email must be valid")
  .transform((email) => email.toLowerCase());

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required")
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: emailSchema,
  password: passwordSchema
});

const forgotPasswordSchema = z.object({
  email: emailSchema
});

const resetPasswordSchema = z.object({
  token: z.string().min(20, "Reset token is required"),
  password: passwordSchema
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Request body is invalid", result.error.flatten());
  }

  return result.data;
}

function assertActiveAccount(status: string): void {
  if (status !== "ACTIVE") {
    throw new AppError(403, "ACCOUNT_NOT_ACTIVE", "This account is not active");
  }
}

async function createTokenResponse(userId: string) {
  const authUser = await getAuthUserById(userId);

  if (!authUser) {
    throw new AppError(500, "AUTH_PROFILE_NOT_FOUND", "Authenticated user profile was not found");
  }

  const token = signAccessToken({
    id: authUser.id,
    email: authUser.email,
    roles: authUser.roles
  });

  return {
    token,
    user: authUser
  };
}

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const user = await prisma.user.findUnique({
      where: {
        email: body.email
      }
    });

    if (!user?.passwordHash) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    const passwordMatches = await verifyPassword(body.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    assertActiveAccount(user.status);

    res.status(200).json(ok(await createTokenResponse(user.id)));
  })
);

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req.body);
    const existingUser = await prisma.user.findUnique({
      where: {
        email: body.email
      }
    });

    if (existingUser) {
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account already exists for this email");
    }

    const employeeRole = await prisma.role.findUnique({
      where: {
        name: "EMPLOYEE"
      }
    });

    if (!employeeRole) {
      throw new AppError(500, "EMPLOYEE_ROLE_MISSING", "The EMPLOYEE role has not been seeded");
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash,
          status: "ACTIVE"
        }
      });

      await transaction.userRole.create({
        data: {
          userId: createdUser.id,
          roleId: employeeRole.id
        }
      });

      await linkExistingEmployeeForUser({
        transaction,
        userId: createdUser.id,
        email: createdUser.email
      });

      return createdUser;
    });

    res.status(201).json(ok(await createTokenResponse(user.id)));
  })
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const body = parseBody(forgotPasswordSchema, req.body);
    const user = await prisma.user.findUnique({
      where: {
        email: body.email
      }
    });

    const response: {
      message: string;
      deliveryMode: "email" | "development_response";
      resetToken?: string;
      expiresAt?: string;
    } = {
      message: "If an active account exists for this email, a reset token has been issued.",
      deliveryMode: "email"
    };

    if (user?.status === "ACTIVE") {
      const resetToken = createPasswordResetToken();
      const expiresAt = getPasswordResetExpiry();

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null
          },
          data: {
            usedAt: new Date()
          }
        }),
        prisma.passwordResetToken.create({
          data: {
            tokenHash: hashPasswordResetToken(resetToken),
            userId: user.id,
            expiresAt
          }
        })
      ]);

      if (process.env.NODE_ENV !== "production") {
        response.deliveryMode = "development_response";
        response.resetToken = resetToken;
        response.expiresAt = expiresAt.toISOString();
      }
    }

    res.status(200).json(ok(response));
  })
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = parseBody(resetPasswordSchema, req.body);
    const tokenHash = hashPasswordResetToken(body.token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash
      },
      include: {
        user: true
      }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new AppError(400, "INVALID_RESET_TOKEN", "Reset token is invalid or expired");
    }

    assertActiveAccount(resetToken.user.status);

    const passwordHash = await hashPassword(body.password);

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: resetToken.userId
        },
        data: {
          passwordHash
        }
      }),
      prisma.passwordResetToken.update({
        where: {
          id: resetToken.id
        },
        data: {
          usedAt: new Date()
        }
      })
    ]);

    res.status(200).json(ok({ message: "Password has been reset" }));
  })
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.auth) {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "A valid access token is required");
    }

    res.status(200).json(
      ok({
        authenticated: true,
        user: req.auth
      })
    );
  })
);

authRouter.post(
  "/logout",
  authenticate,
  asyncHandler(async (_req, res) => {
    res.status(200).json(ok({ message: "Logged out" }));
  })
);
