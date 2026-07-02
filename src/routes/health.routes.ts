import { Router } from "express";
import { env } from "../config/env";
import { getIssuerAddress } from "../issuer/issuerService";
import { getOperatorAddress } from "../hsp/mandateBuilder";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    environment: env.NODE_ENV,
    activeChain: env.ACTIVE_CHAIN,
  });
});

/**
 * Slightly more revealing than /health on purpose - useful during
 * development to confirm the backend actually started with the keys/config
 * you expect, without grepping server logs. Does NOT expose anything
 * secret - addresses are public information, never the keys themselves.
 */
healthRouter.get("/health/config", (_req, res) => {
  res.json({
    activeChain: env.ACTIVE_CHAIN,
    issuerAddress: getIssuerAddress(),
    operatorAddress: getOperatorAddress(),
    hspCoordinatorUrl: env.HSP_COORDINATOR_URL,
    attestationRegistryAddress: env.ATTESTATION_REGISTRY_ADDRESS,
    payrollTreasuryAddress: env.PAYROLL_TREASURY_ADDRESS,
  });
});
