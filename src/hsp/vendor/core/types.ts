// Vendored from project-hsp/hsp packages/core/src/core/types.ts (Apache-2.0).

import { keccak256, encodeAbiParameters, type Hex } from "viem";
import type { DomainInput, SignerInput, RecipientInput, MandateBodyInput, ReceiptInput } from "../derivations";

export type Domain = DomainInput;
export type Signer = SignerInput;
export type Recipient = RecipientInput;

export const RecipientKind = { ADDRESS: 0, COMMITMENT: 1 } as const;
export type RecipientKindValue = (typeof RecipientKind)[keyof typeof RecipientKind];

export type MandateBody = MandateBodyInput;

export interface SignedMandate {
  body: MandateBody;
  signerProof: Hex;
  requiredCapabilities: Hex[];
}

export const Outcome = { ATTEMPTED: 0, SETTLED: 1, FAILED: 2, DISPUTED: 3 } as const;
export type OutcomeValue = (typeof Outcome)[keyof typeof Outcome];

export interface Receipt extends ReceiptInput {
  adapterSignature: Hex;
}

export interface PartyRef {
  scheme: string;
  id: Hex;
}

export function canonicalRefId(ref: PartyRef): Hex {
  return keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes" }], [ref.scheme, ref.id]));
}

export function partyRefEqual(a: PartyRef, b: PartyRef): boolean {
  return canonicalRefId(a) === canonicalRefId(b);
}

export interface Attestation {
  capabilityId: Hex;
  schemaId: Hex;
  claims: Hex;
  issuer: PartyRef;
  issuerKeyId: Hex;
  subjectBinding: PartyRef;
  contextBinding: Hex;
  issuedAt: number;
  expiresAt: number;
  issuerSignature: Hex;
}
