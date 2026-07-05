// Vendored from project-hsp/hsp packages/core/src/policy/compliance.ts (Apache-2.0).

import { type Address, type Hex } from "viem";
import { makeCap, familyCapId, Roles, type ParsedCapability } from "../core/capabilities";
import { evmIssuerKeyId } from "../attestation/issuer";
import { KYC_SCHEMA_ID, SANCTIONS_SCHEMA_ID } from "../attestation/schemas";
import type { TrustAnchor, VerificationPolicy } from "../verifier/contracts";
import { buildPublicPolicy, buildPublicRequirements, type MandateRequirements, type HspChainConfig } from "./public";

export const KYC_FULL: ParsedCapability = makeCap("attests:kyc:v1", { level: "full" }, Roles.payer);
export const KYC_BASIC: ParsedCapability = makeCap("attests:kyc:v1", { level: "basic" }, Roles.payer);
export const SANCTIONS: ParsedCapability = makeCap("attests:sanctions:v1", {}, Roles.payer);

export const COMPLIANCE_REGISTRY_CAPS: ParsedCapability[] = [KYC_BASIC, KYC_FULL, SANCTIONS];

export type ComplianceTag = "kyc" | "kyc-basic" | "sanctions";

const TAG_TO_CAP: Record<ComplianceTag, ParsedCapability> = {
  kyc: KYC_FULL,
  "kyc-basic": KYC_BASIC,
  sanctions: SANCTIONS,
};

export function resolveComplianceCaps(tags: ComplianceTag[]): ParsedCapability[] {
  return tags.map((t) => {
    const c = TAG_TO_CAP[t];
    if (!c) throw new Error(`unknown compliance tag: ${t}`);
    return c;
  });
}

export type ComplianceFamily = "attests:kyc:v1" | "attests:sanctions:v1";

export interface TrustedIssuer {
  family: ComplianceFamily;
  issuerAddress: Address;
}

const FAMILY_SCHEMA: Record<ComplianceFamily, Hex> = {
  "attests:kyc:v1": KYC_SCHEMA_ID,
  "attests:sanctions:v1": SANCTIONS_SCHEMA_ID,
};

export interface CompliancePolicyOpts {
  trustedIssuers: TrustedIssuer[];
  policyRequiredCaps?: ParsedCapability[];
}

export function applyComplianceToPolicy(policy: VerificationPolicy, opts: CompliancePolicyOpts): VerificationPolicy {
  for (const c of COMPLIANCE_REGISTRY_CAPS) policy.capabilityRegistry.set(c.id, c);
  for (const ti of opts.trustedIssuers) {
    const key = familyCapId(ti.family);
    const list = policy.issuerTrustAnchors.get(key) ?? [];
    const anchor: TrustAnchor = {
      scheme: "evm-key",
      identifier: evmIssuerKeyId(ti.issuerAddress),
      acceptedSchemaIds: [FAMILY_SCHEMA[ti.family]],
    };
    list.push(anchor);
    policy.issuerTrustAnchors.set(key, list);
  }
  if (opts.policyRequiredCaps && opts.policyRequiredCaps.length > 0) {
    policy.policyRequiredCapabilities = [
      ...(policy.policyRequiredCapabilities ?? []),
      ...opts.policyRequiredCaps.map((c) => c.id),
    ];
  }
  return policy;
}

export function buildCompliancePolicy(
  chain: HspChainConfig,
  adapterAddress: Address,
  evaluationTime: number,
  opts: CompliancePolicyOpts
): VerificationPolicy {
  return applyComplianceToPolicy(buildPublicPolicy(chain, adapterAddress, evaluationTime), opts);
}

export function buildComplianceRequirements(
  chain: HspChainConfig,
  opts: {
    expiresAt: number;
    extraAdapters?: MandateRequirements["adapters"];
    extraOffered?: string[];
  } & CompliancePolicyOpts
): MandateRequirements {
  const issuers: MandateRequirements["issuers"] = {};
  for (const ti of opts.trustedIssuers) {
    const k = ti.family;
    (issuers[k] ??= []).push({
      scheme: "evm-key",
      identifier: evmIssuerKeyId(ti.issuerAddress),
      acceptedSchemaIds: [FAMILY_SCHEMA[ti.family]],
    });
  }
  const offered = [...COMPLIANCE_REGISTRY_CAPS.map((c) => c.id as string), ...(opts.extraOffered ?? [])];
  const required = (opts.policyRequiredCaps ?? []).map((c) => c.id as string);
  return buildPublicRequirements(chain, {
    expiresAt: opts.expiresAt,
    policyRequiredCapabilities: required,
    offeredCapabilities: offered,
    issuers,
    ...(opts.extraAdapters ? { extraAdapters: opts.extraAdapters } : {}),
  });
}
