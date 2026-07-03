import { Router } from "express";
import { z } from "zod";
import { parseUnits } from "viem";
import { validateBody } from "../middleware/validate";
import { requireOperatorAuth } from "../middleware/auth";
import { buildSignedMandate, getOperatorAddress } from "../hsp/mandateBuilder";
import { makeCap } from "../hsp/vendor/core/capabilities";
import { mandateHash as computeMandateHash } from "../hsp/vendor/derivations";
import { buildComplianceRequirements } from "../hsp/vendor/policy/compliance";
import { capLabel } from "../hsp/vendor/policy/labels";
import { checkRequirements } from "../hsp/checkRequirements";
import { hspCoordinatorClient } from "../hsp/coordinatorClient";
import { hspVerifier } from "../hsp/verifierClient";
import { releasePaymentOnChain } from "../chain/payrollTreasuryClient";
import { validateProposedPayment, getPayeeStatus } from "../payees/payeeService";
import { recordPaymentHistory } from "../db/schema";
import { hspConfig } from "../config/hsp";
import { AppError, ComplianceError } from "../utils/result";
import { logger } from "../utils/logger";

export const paymentsRouter = Router();

const ReleasePaymentBodySchema = z.object({
  payeeIdentifier: z.string(),
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string(),
  requiredCapabilities: z.array(z.string()).default([]),
});

const TOKEN_DECIMALS = 6;

/**
 * ARCHITECTURE NOTE - CONFIRMED 2026-06-27: HSP's protocol supports exactly
 * one signer profile (eip712-eoa.v1, packages/core/src/profiles/signer/
 * eip712-eoa.ts) - strict ECDSA-only, no EIP-1271/contract-signer support
 * exists anywhere in @hsp/core or @hsp/sdk (confirmed by direct source grep,
 * zero matches). This means a smart contract (like PayrollTreasury) CANNOT
 * be a Mandate's payer/signer - only a real EOA can sign a Mandate.
 *
 * Earlier drafts of this route incorrectly set mandate.payer to
 * PAYROLL_TREASURY_ADDRESS - that was wrong and would have failed signature
 * verification (a contract address has no private key to sign with). Fixed:
 * HSP and PayrollTreasury now run as two INDEPENDENT, parallel checks rather
 * than one nested inside the other:
 *   - HSP's Mandate is signed by a real EOA (the backend operator's own
 *     key, BACKEND_SIGNER) and verified via the Coordinator + our own
 *     hspVerifier - this proves "this payment intent carries a valid,
 *     compliance-attested signature."
 *   - PayrollTreasury.releasePayment() is a SEPARATE on-chain action with
 *     its OWN independent compliance check (AttestationRegistry.
 *     isValidWithMinLevel), enforced regardless of what HSP concluded.
 * Both checks are real and both must pass; neither mechanically depends on
 * the other's settlement. This is a more defensible compliance story, not
 * a workaround - two independent gates, not one pretending to wrap the other.
 */
paymentsRouter.post(
  "/payments/release",
  requireOperatorAuth,
  validateBody(ReleasePaymentBodySchema),
  async (req, res) => {
    const { payeeIdentifier, token, amount, requiredCapabilities } = req.body;

    const preCheck = await validateProposedPayment({ identifier: payeeIdentifier, amount });
    if (!preCheck.valid) {
      throw new AppError(`Payment failed pre-check: ${preCheck.errors.join("; ")}`, 422);
    }

    const payeeStatus = await getPayeeStatus(payeeIdentifier);
    if (!payeeStatus) {
      throw new AppError(`Payee "${payeeIdentifier}" not found`, 404);
    }

    // requiredCapabilities arrives as capability KEY strings (e.g.
    // "attests:kyc:v1") - HSP's wire format needs actual capability IDs
    // (bytes32 hashes), not the key strings themselves. makeCap() with no
    // params/role gives the BASE id; level-specific caps (kyc basic/full)
    // are role-wrapped + leveled in policy/compliance.ts's KYC_FULL/KYC_BASIC,
    // not reconstructed here - this mandate only needs the base ids.
    const capabilityIds = requiredCapabilities.map((key: string) => makeCap(key).id);

    const mandate = await buildSignedMandate({
      payer: getOperatorAddress(),
      payee: payeeStatus.address,
      token: token as `0x${string}`,
      amount: parseUnits(amount, TOKEN_DECIMALS),
      requiredCapabilities: capabilityIds,
    });

    // Pre-flight: confirm the mandate covers what this deployment actually
    // requires BEFORE spending a Coordinator round trip on a submission that
    // would obviously fail. Mirrors @hsp/mcp's hsp_check_requirements logic.
    const hspChainConfig = {
      chainId: hspConfig.chain.id,
      verifyingContract: hspConfig.trust.verifyingContract as `0x${string}`,
      adapterInstanceKey:
        "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
    };
    const requirements = buildComplianceRequirements(hspChainConfig, {
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      trustedIssuers: [
        ...hspConfig.trust.trustedIssuers["attests:kyc:v1"].map((i) => ({
          family: "attests:kyc:v1" as const,
          issuerAddress: i.issuerAddress as `0x${string}`,
        })),
      ],
    });
    const preflight = checkRequirements(mandate, requirements);
    if (!preflight.ok) {
      const missingLabeled = preflight.missingRequiredCapabilities.map(capLabel).join(", ");
      throw new ComplianceError(
        `Mandate does not satisfy deployment requirements - missing: ${missingLabeled || "none"}, chainOk: ${preflight.chainOk}`
      );
    }

    const registration = await hspCoordinatorClient.registerMandate(mandate);
    await hspCoordinatorClient.observePayment(registration.paymentId);

    const { decision } = await hspVerifier.fetchAndVerify(registration.paymentId);

    if (!decision.ok) {
      throw new ComplianceError(
        `HSP verification did not ACCEPT this payment intent: ${decision.reason ?? decision.outcomeClass}`
      );
    }

    // SignedMandate carries no precomputed hash field - derive it the same
    // way the Coordinator/verifier do, via the vendored mandateHash().
    const realMandateHash = computeMandateHash(
      {
        name: "HSP",
        version: "1",
        chainId: mandate.body.chainId,
        verifyingContract: hspConfig.trust.verifyingContract as `0x${string}`,
      },
      mandate.body
    );

    // Independent second gate: PayrollTreasury re-checks compliance itself
    // (AttestationRegistry) before releasing - this does not trust or
    // depend on HSP's decision above; it is a fully separate enforcement.
    const txHash = await releasePaymentOnChain({
      payee: payeeStatus.address,
      token: token as `0x${string}`,
      amount: parseUnits(amount, TOKEN_DECIMALS),
      mandateHash: realMandateHash,
    });

    recordPaymentHistory({
      payeeIdentifier,
      amount,
      token,
      mandateHash: realMandateHash,
      releasedAt: Math.floor(Date.now() / 1000),
      createdAt: Math.floor(Date.now() / 1000),
    });

    logger.info("Payment released", { payeeIdentifier, amount, txHash });

    res.status(201).json({
      paymentId: registration.paymentId,
      mandateHash: realMandateHash,
      onChainTxHash: txHash,
      decision,
    });
  }
);

paymentsRouter.get("/payments/:paymentId", async (req, res) => {
  const { decision, payment } = await hspVerifier.fetchAndVerify(req.params.paymentId);
  res.json({ payment, decision });
});
