// Vendored from project-hsp/hsp packages/core/src/policy/public.ts (Apache-2.0).
// ChainConfig import adapted: real source imports from "../chains/index" (not
// vendored, workspace-private chain registry). We use our own
// config/hsp.ts-shaped chain config instead - see HspChainConfig below.

import { keccak256, stringToBytes, type Address, type Hex } from "viem";
import { eip712EoaSigner } from "../profiles/signer/eip712-eoa";
import { adapterKey, schemaKey, type ReorgPolicy, type VerificationPolicy } from "../verifier/contracts";
import { evmTransferSchema, EVM_TRANSFER_ADAPTER_ID, EVM_TRANSFER_PROOF_SCHEMA_ID } from "../adapter/mock-evm-transfer";

export interface HspChainConfig {
  chainId: number;
  verifyingContract: Address;
  adapterInstanceKey: Hex;
}

export const EVM_TRANSFER_REORG_POLICY: ReorgPolicy = {
  allowsAttempted: true,
  chainObservation: "required",
  disputeWindowMs: 30_000,
};

export function buildPublicPolicy(
  chain: HspChainConfig,
  adapterAddress: Address,
  evaluationTime: number
): VerificationPolicy {
  return {
    verifyingContract: chain.verifyingContract,
    acceptedVerifyingContracts: new Set([chain.verifyingContract.toLowerCase()]),
    signerProfiles: new Map([[eip712EoaSigner.profileIdHash, { profile: eip712EoaSigner }]]),
    adapterTrust: new Map([
      [
        adapterKey(EVM_TRANSFER_ADAPTER_ID, chain.adapterInstanceKey),
        { address: adapterAddress, reorgPolicy: EVM_TRANSFER_REORG_POLICY },
      ],
    ]),
    proofSchemas: new Map([
      [
        schemaKey(EVM_TRANSFER_ADAPTER_ID, EVM_TRANSFER_PROOF_SCHEMA_ID),
        { schema: evmTransferSchema, allowedCapabilities: [], admission: "accept-new" as const, trustRoots: {} },
      ],
    ]),
    capabilityRegistry: new Map(),
    issuerTrustAnchors: new Map(),
    contextBindingScope: new Map(),
    evaluationTime,
  };
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(rec[k])}`).join(",")}}`;
}

export interface MandateRequirements {
  hspVersion: string;
  policyHash: Hex;
  expiresAt: number;
  domain: { verifyingContract: Address; chainIds: number[] };
  signerProfiles: string[];
  policyRequiredCapabilities: string[];
  offeredCapabilities: string[];
  issuers: Record<string, { scheme: string; identifier: string; acceptedSchemaIds: Hex[] }[]>;
  contextBindingScope: Record<string, "mandate" | "receipt">;
  adapters: {
    adapterId: string;
    adapterInstanceKey: Hex;
    proofSchemaId: Hex;
    schemaAdmission: "accept-new" | "accept-historical" | "accept-dispute-only";
    allowedCapabilities: string[];
    reorgPolicy: ReorgPolicy;
  }[];
}

export function buildPublicRequirements(
  chain: HspChainConfig,
  opts: {
    expiresAt: number;
    policyRequiredCapabilities?: string[];
    offeredCapabilities?: string[];
    issuers?: MandateRequirements["issuers"];
    extraAdapters?: MandateRequirements["adapters"];
  }
): MandateRequirements {
  const core = {
    hspVersion: "1",
    domain: { verifyingContract: chain.verifyingContract, chainIds: [chain.chainId] },
    signerProfiles: ["eip712-eoa.v1"],
    policyRequiredCapabilities: opts.policyRequiredCapabilities ?? [],
    offeredCapabilities: opts.offeredCapabilities ?? [],
    issuers: opts.issuers ?? {},
    contextBindingScope: {} as MandateRequirements["contextBindingScope"],
    adapters: [
      {
        adapterId: "adapter:evm-transfer",
        adapterInstanceKey: chain.adapterInstanceKey,
        proofSchemaId: EVM_TRANSFER_PROOF_SCHEMA_ID,
        schemaAdmission: "accept-new" as const,
        allowedCapabilities: [] as string[],
        reorgPolicy: EVM_TRANSFER_REORG_POLICY,
      },
      ...(opts.extraAdapters ?? []),
    ],
  };
  const policyHash = keccak256(stringToBytes(stableStringify(core)));
  return { ...core, policyHash, expiresAt: opts.expiresAt };
}
