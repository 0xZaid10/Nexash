/**
 * VENDORED FROM: project-hsp/hsp, packages/core/src/derivations.ts
 * (Apache-2.0). Copied verbatim on 2026-06-27 from a direct read of the
 * source file, not reimplemented from description - this is the actual
 * mandateHash / requiredCapabilitiesHash derivation HSP's own Coordinator
 * and verifier use, so our computed mandateHash will match theirs exactly.
 *
 * Vendored (not imported via npm) because @hsp/core is a private workspace
 * package inside the HSP monorepo, not published to the public npm
 * registry - there is currently no way to `npm install @hsp/core` from an
 * external project. If/when HSP publishes these packages, prefer the real
 * import over this vendored copy.
 *
 * DO NOT hand-edit this file to "fix" something that looks wrong - if our
 * usage seems broken, the bug is almost certainly in how we're CALLING this
 * file, not in this file itself. Re-pull from upstream if HSP's own
 * implementation changes.
 */

import { keccak256, encodeAbiParameters, hashTypedData, type Hex, type Address } from "viem";

export type ParamType = "string" | "uint256" | "bytes32" | "bool" | "address";

export interface CanonicalParam {
  key: string;
  type: ParamType;
  value: string | number | boolean;
}

export interface CapabilityIdInput {
  namespace: string;
  name: string;
  version: string;
  params: CanonicalParam[];
}

export function canonicalParamsEncoding(params: CanonicalParam[]): Hex {
  if (params.length === 0) return "0x";
  const sorted = [...params].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const parts = sorted.map((p) => {
    const value = coerceParamValue(p);
    return encodeAbiParameters([{ type: "string" }, { type: p.type }], [p.key, value]);
  });
  return ("0x" + parts.map((h) => h.slice(2)).join("")) as Hex;
}

type AbiParamValue = string | bigint | boolean | Hex | Address;

function coerceParamValue(p: CanonicalParam): AbiParamValue {
  switch (p.type) {
    case "string":
      if (typeof p.value !== "string") throw new Error(`param ${p.key}: expected string`);
      return p.value;
    case "uint256":
      return BigInt(typeof p.value === "number" ? p.value : String(p.value));
    case "bytes32":
      if (typeof p.value !== "string" || !p.value.startsWith("0x")) {
        throw new Error(`param ${p.key}: bytes32 must be 0x-prefixed hex`);
      }
      return p.value as Hex;
    case "bool":
      return Boolean(p.value);
    case "address":
      if (typeof p.value !== "string" || !p.value.startsWith("0x")) {
        throw new Error(`param ${p.key}: address must be 0x-prefixed hex`);
      }
      return p.value as Address;
  }
}

export function capabilityId(input: CapabilityIdInput): Hex {
  const paramsCanon = canonicalParamsEncoding(input.params);
  const paramsHash = keccak256(paramsCanon);
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "bytes32" }],
      [input.namespace, input.name, input.version, paramsHash]
    )
  );
}

const ZERO_HASH: Hex = ("0x" + "00".repeat(32)) as Hex;

export function requiredCapabilitiesHash(capabilities: Hex[]): Hex {
  const normalized = capabilities.map((c) => c.toLowerCase() as Hex);
  const dedup = Array.from(new Set(normalized));
  const sorted = [...dedup].sort();
  if (sorted.length === 0) return ZERO_HASH;
  return keccak256(encodeAbiParameters([{ type: "bytes32[]" }], [sorted]));
}

export interface DomainInput {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export interface SignerInput {
  profileId: Hex;
  payload: Hex;
}

export interface RecipientInput {
  kind: number;
  payload: Hex;
}

export interface MandateBodyInput {
  nonce: Hex;
  signer: SignerInput;
  grantRef: Hex;
  requirementRef: Hex;
  recipient: RecipientInput;
  token: Address;
  amount: string;
  chainId: number | string;
  deadline: number;
  settlementBinding: Hex;
  requiredCapabilitiesHash: Hex;
}

export const NESTED_TYPES = {
  Recipient: [
    { name: "kind", type: "uint8" },
    { name: "payload", type: "bytes" },
  ],
  Signer: [
    { name: "profileId", type: "bytes32" },
    { name: "payload", type: "bytes" },
  ],
} as const;

export const MANDATE_BODY_FIELDS = [
  { name: "nonce", type: "bytes32" },
  { name: "signer", type: "Signer" },
  { name: "grantRef", type: "bytes32" },
  { name: "requirementRef", type: "bytes32" },
  { name: "recipient", type: "Recipient" },
  { name: "token", type: "address" },
  { name: "amount", type: "uint256" },
  { name: "chainId", type: "uint256" },
  { name: "deadline", type: "uint64" },
  { name: "settlementBinding", type: "bytes32" },
  { name: "requiredCapabilitiesHash", type: "bytes32" },
] as const;

const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

function bodyMessage(b: MandateBodyInput): Record<string, unknown> {
  return {
    nonce: b.nonce,
    signer: { profileId: b.signer.profileId, payload: b.signer.payload },
    grantRef: b.grantRef ?? ZERO32,
    requirementRef: b.requirementRef ?? ZERO32,
    recipient: { kind: b.recipient.kind, payload: b.recipient.payload },
    token: b.token,
    amount: BigInt(b.amount),
    chainId: BigInt(b.chainId),
    deadline: BigInt(b.deadline),
    settlementBinding: b.settlementBinding ?? ZERO32,
    requiredCapabilitiesHash: b.requiredCapabilitiesHash,
  };
}

type HashTypedDataArgs = Parameters<typeof hashTypedData>[0];

export function mandateHash(domain: DomainInput, body: MandateBodyInput): Hex {
  return hashTypedData({
    domain,
    types: {
      Mandate: [...MANDATE_BODY_FIELDS],
      ...NESTED_TYPES,
    },
    primaryType: "Mandate",
    message: bodyMessage(body),
  } as unknown as HashTypedDataArgs);
}

export interface ReceiptInput {
  mandateHash: Hex;
  adapterId: Hex;
  adapterInstanceKey: Hex;
  seq: number | string;
  outcome: number;
  settledAt: number | string;
  proofSchemaId: Hex;
  adapterProof: Hex;
}

export const RECEIPT_PREIMAGE_FIELDS = [
  { name: "mandateHash", type: "bytes32" },
  { name: "adapterId", type: "bytes32" },
  { name: "adapterInstanceKey", type: "bytes32" },
  { name: "seq", type: "uint64" },
  { name: "outcome", type: "uint8" },
  { name: "settledAt", type: "uint64" },
  { name: "proofSchemaId", type: "bytes32" },
  { name: "adapterProofHash", type: "bytes32" },
] as const;

export function receiptHash(domain: DomainInput, receipt: ReceiptInput): Hex {
  const adapterProofHash = keccak256(receipt.adapterProof);
  return hashTypedData({
    domain,
    types: { ReceiptPreimage: [...RECEIPT_PREIMAGE_FIELDS] },
    primaryType: "ReceiptPreimage",
    message: {
      mandateHash: receipt.mandateHash,
      adapterId: receipt.adapterId,
      adapterInstanceKey: receipt.adapterInstanceKey,
      seq: BigInt(receipt.seq),
      outcome: receipt.outcome,
      settledAt: BigInt(receipt.settledAt),
      proofSchemaId: receipt.proofSchemaId,
      adapterProofHash,
    },
  } as unknown as HashTypedDataArgs);
}
