import type { SignedMandate } from "./vendor/core/types";
import type { MandateRequirements } from "./vendor/policy/public";

export interface CheckRequirementsResult {
  ok: boolean;
  chainOk: boolean;
  missingRequiredCapabilities: string[];
}

/**
 * Mirrors @hsp/mcp's hsp_check_requirements tool logic exactly - same
 * checks, no MCP server needed since we already have direct @hsp/core
 * access. Call this BEFORE registering a mandate with the Coordinator, so
 * a payment that would obviously fail never gets submitted at all.
 */
export function checkRequirements(
  mandate: SignedMandate,
  requirements: MandateRequirements
): CheckRequirementsResult {
  const have = new Set((mandate.requiredCapabilities ?? []).map((id) => id.toLowerCase()));
  const missing = (requirements.policyRequiredCapabilities ?? []).filter(
    (id) => !have.has(id.toLowerCase())
  );
  const chainOk = requirements.domain.chainIds.includes(Number(mandate.body.chainId));

  return {
    ok: missing.length === 0 && chainOk,
    chainOk,
    missingRequiredCapabilities: missing,
  };
}
