import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { requireOperatorAuth } from "../middleware/auth";
import { issueKycAttestation } from "../issuer/issuerService";
import {
  recordAttestationOnChain,
  isAttestationValid,
  getOnChainAttestation,
} from "../chain/attestationRegistryClient";
import { logIssuedAttestation, markAttestationAnchored } from "../db/schema";
import { CAPABILITY, CAPABILITY_BYTES32 } from "../config/hsp";
import { AppError } from "../utils/result";
import { logger } from "../utils/logger";

export const attestationsRouter = Router();

const IssueKycBodySchema = z.object({
  subject: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  reportTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  taskId: z.string(),
  templateId: z.string(),
});

/**
 * The full pipeline, end to end: verify the NexaID report on-chain and
 * against NexaID's API (issuerService -> nexaidVerifier), sign a real HSP
 * attestation, log the signature durably BEFORE attempting the on-chain
 * anchor (so a failed anchor never loses the signed result - see
 * db/migrations/001_init.sql's issued_attestations_log comment), then
 * anchor it on AttestationRegistry. recordAttestationOnChain now correctly
 * signs with the issuer's own key (see chain/attestationRegistryClient.ts) -
 * the earlier signer-mismatch issue is resolved.
 *
 * KNOWN OPEN ISSUE - PLACEHOLDER SCHEMA IDS: issuerService.ts's
 * hspAttestation uses placeholder capability/schema IDs (see issuer/
 * schema.ts's KYC_CAPABILITY_ID_PLACEHOLDER) rather than @hsp/core's real
 * makeCap()/KYC_SCHEMA_ID values, which are not yet vendored. The
 * structHash/signature this produces is internally consistent but will NOT
 * be accepted by HSP's actual verifier until the real schema IDs are
 * vendored in. The on-chain AttestationRegistry anchor below is unaffected
 * by this (it's our own contract, our own shape) - only the HSP-facing
 * hspAttestation in the response is impacted.
 */
attestationsRouter.post(
  "/attestations/issue-kyc",
  requireOperatorAuth,
  validateBody(IssueKycBodySchema),
  async (req, res) => {
    const { subject, reportTxHash, taskId, templateId } = req.body;

    const issued = await issueKycAttestation({
      subject,
      reportTxHash,
      taskId,
      templateId,
    });

    logIssuedAttestation({
      subject,
      capability: CAPABILITY.KYC,
      kycLevel: issued.ourNumericKycLevel,
      reportTxHash,
      taskId,
      signature: issued.hspAttestation.issuerSignature,
      onChainTxHash: null,
      issuedAt: issued.hspAttestation.issuedAt,
    });

    let onChainTxHash: string | null = null;
    try {
      onChainTxHash = await recordAttestationOnChain({
        subject,
        capability: CAPABILITY_BYTES32.KYC,
        reportTxHash: reportTxHash as `0x${string}`,
        taskId: taskId as `0x${string}`,
        kycLevel: issued.ourNumericKycLevel,
        expiresAt: issued.hspAttestation.expiresAt,
      });
      markAttestationAnchored(reportTxHash, onChainTxHash);
    } catch (err) {
      // The signature was already produced and logged above - this is
      // recoverable (retry the on-chain anchor later against the logged
      // row) rather than a reason to claim total failure to the caller.
      logger.error("On-chain attestation anchor failed after signing succeeded", {
        subject,
        reportTxHash,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    res.status(201).json({
      hspAttestation: issued.hspAttestation,
      hspLevel: issued.hspLevel,
      onChainTxHash,
      anchored: onChainTxHash !== null,
    });
  }
);

attestationsRouter.get("/attestations/:subject", async (req, res) => {
  const subject = req.params.subject;

  if (!/^0x[a-fA-F0-9]{40}$/.test(subject)) {
    throw new AppError("subject must be a valid EVM address", 422);
  }

  const [kycValid, attestation] = await Promise.all([
    isAttestationValid(subject as `0x${string}`, CAPABILITY_BYTES32.KYC),
    getOnChainAttestation(subject as `0x${string}`, CAPABILITY_BYTES32.KYC),
  ]);

  res.json({
    subject,
    capability: CAPABILITY.KYC,
    valid: kycValid,
    attestation,
  });
});
