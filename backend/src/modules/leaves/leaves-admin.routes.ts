import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/authenticate";
import { requirePermissions } from "../../middleware/authorize";
import { AppError } from "../../middleware/error-handler";
import { ok } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";

export const leavesAdminRouter = Router();

const uuidSchema = z.string().uuid();

leavesAdminRouter.use(authenticate);

leavesAdminRouter.put(
  "/balances/:balanceId/carry-forward",
  requirePermissions(["leave:manage"]),
  asyncHandler(async (req, res) => {
    const { balanceId } = parseParams(uuidSchema, req.params);
    const body = parseInput(z.object({
      carryForward: z.number().min(0)
    }), req.body);
    
    const existingBalance = await prisma.leaveBalance.findUnique({
      where: { id: balanceId }
    });
    
    if (!existingBalance) {
      throw new AppError(404, "BALANCE_NOT_FOUND", "Leave balance not found");
    }
    
    const updatedBalance = await prisma.leaveBalance.update({
      where: { id: balanceId },
      data: { 
        carryForward: body.carryForward,
        available: existingBalance.openingBalance + existingBalance.accrued + body.carryForward - existingBalance.used - existingBalance.pending
      }
    });
    
    res.status(200).json(ok({ leaveBalance: updatedBalance }));
  })
);

leavesAdminRouter.post(
  "/reset/annual",
  requirePermissions(["leave:manage"]),
  asyncHandler(async (req, res) => {
    const { performAnnualLeaveReset } = require("./leave-reset.service");
    await performAnnualLeaveReset();
    res.status(200).json(ok({ message: "Annual leave reset completed" }));
  })
);

function parseParams<T>(schema: z.ZodSchema<T>, params: unknown): T {
  return schema.parse(params);
}

function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}
