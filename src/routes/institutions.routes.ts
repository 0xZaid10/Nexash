import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { requireOperatorAuth } from "../middleware/auth";
import { registerPayee, getPayeeDirectory, getPayeeStatus } from "../payees/payeeService";
import { parsePaymentIntent } from "../agents/paymentsAgent/intentParser";
import { reviewPaymentBatch } from "../agents/paymentsAgent/anomalyReview";
import { getPaymentHistoryForPayee } from "../db/schema";
import { CAPABILITY } from "../config/hsp";
import { AppError } from "../utils/result";

export const institutionsRouter = Router();

const RegisterPayeeBodySchema = z.object({
  identifier: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  requiredCapability: z.enum([CAPABILITY.KYC, CAPABILITY.SANCTIONS]),
  minKycLevel: z.number().int().min(0).max(4),
  perPaymentLimit: z.string(),
  dailyLimit: z.string(),
});

institutionsRouter.post(
  "/institutions/payees",
  requireOperatorAuth,
  validateBody(RegisterPayeeBodySchema),
  async (req, res) => {
    const result = await registerPayee(req.body);

    if (!result.success) {
      throw new AppError(`Failed to register payee: ${result.errors?.join("; ")}`, 422);
    }

    res.status(201).json(result);
  }
);

institutionsRouter.get("/institutions/payees", requireOperatorAuth, async (_req, res) => {
  const directory = await getPayeeDirectory();
  res.json({ payees: directory });
});

institutionsRouter.get(
  "/institutions/payees/:identifier",
  requireOperatorAuth,
  async (req, res) => {
    const status = await getPayeeStatus(req.params.identifier);
    if (!status) {
      throw new AppError(`Payee "${req.params.identifier}" not found`, 404);
    }
    res.json(status);
  }
);

const ParseIntentBodySchema = z.object({
  instruction: z.string().min(1),
});

/**
 * Pure agent-proposal endpoint - calls intentParser.ts, which has no
 * import path to anything that moves funds. This endpoint cannot, by
 * construction, cause a payment to execute - it only returns structured
 * proposals for a human (or a subsequent, separate call to
 * /payments/release) to act on.
 */
institutionsRouter.post(
  "/institutions/payroll/parse",
  requireOperatorAuth,
  validateBody(ParseIntentBodySchema),
  async (req, res) => {
    const payeeDirectory = await getPayeeDirectory();
    const result = await parsePaymentIntent({
      instruction: req.body.instruction,
      payeeDirectory,
    });
    res.json(result);
  }
);

const ReviewBatchBodySchema = z.object({
  proposedPayments: z.array(
    z.object({
      payeeIdentifier: z.string(),
      resolvedPayeeAddress: z.string().nullable(),
      amount: z.string(),
      token: z.string(),
      hold: z.boolean(),
      holdReason: z.string().nullable(),
    })
  ),
});

/**
 * Same isolation guarantee as /payroll/parse - reviewPaymentBatch's result
 * is typed with advisoryOnly: true and has no path to execution. This
 * endpoint exists to be called BEFORE /payments/release, surfacing flags to
 * a human operator in between - the route layer does not enforce that
 * ordering (it cannot, across two independent HTTP calls), so it remains
 * the calling client/bot's responsibility to actually show these flags to a
 * human before proceeding, not just call this and ignore the result.
 */
institutionsRouter.post(
  "/institutions/payroll/review",
  requireOperatorAuth,
  validateBody(ReviewBatchBodySchema),
  async (req, res) => {
    const proposedPayments = req.body.proposedPayments;

    const payeeHistory = proposedPayments.map((p: { payeeIdentifier: string }) => {
      const history = getPaymentHistoryForPayee(p.payeeIdentifier);
      return {
        payeeIdentifier: p.payeeIdentifier,
        pastAmounts: history.map((h) => h.amount),
        lastPaymentTimestamp: history[0]?.releasedAt ?? null,
      };
    });

    const review = await reviewPaymentBatch({ proposedPayments, payeeHistory });
    res.json(review);
  }
);

institutionsRouter.get(
  "/institutions/payees/:identifier/history",
  requireOperatorAuth,
  async (req, res) => {
    const { identifier } = req.params;
    const payee = await getPayeeStatus(identifier);
    if (!payee) throw new AppError(`Payee "${identifier}" not found`, 404);

    const history = getPaymentHistoryForPayee(identifier);
    res.json({ identifier, history });
  }
);

institutionsRouter.delete(
  "/institutions/payees/:identifier",
  requireOperatorAuth,
  async (req, res) => {
    const { identifier } = req.params;
    const { SqlitePayeeRepository } = await import("../db/schema");
    const repo = new SqlitePayeeRepository();
    const existing = await repo.findByIdentifier(identifier);
    if (!existing) throw new AppError(`Payee "${identifier}" not found`, 404);
    await repo.delete(identifier);
    res.json({ deleted: true, identifier });
  }
);
