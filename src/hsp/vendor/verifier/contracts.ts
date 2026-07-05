// Vendored from project-hsp/hsp packages/core/src/verifier/contracts.ts (Apache-2.0).

import type { Address, Hex } from "viem";
import type { PartyRef, MandateBody, Receipt, ParsedCapability } from "../core/index";

export type OutcomeClass = "ACCEPT" | "RETRYABLE" | "POLICY" | "PERMANENT";

export interface AcceptDecision {
  ok: boolean;
  outcomeClass: OutcomeClass;
  errorCode?: string;
  errorDetail?: string;
}

export interface SignerDecision {
  granted: boolean;
  errorCode?: string;
  resolvedSubject?: PartyRef;
  signerStateHash?: Hex;
}

export interface SignerProfileDescription {
  profileId: string;
  signatureSchemes: string[];
  bindsRequiredCapabilitiesHash: boolean;
  supportsBatch: boolean;
  stateDependent: boolean;
}

export interface SignerStateAnchor {
  [k: string]: unknown;
}

export interface SignerProfile {
  readonly profileId: string;
  readonly profileIdHash: Hex;
  readonly description: SignerProfileDescription;
  decode(payload: Hex): PartyRef;
  verify(payload: Hex, proof: Hex, mandateHash: Hex, body: MandateBody): Promise<SignerDecision>;
  isStateStale?(signerStateHash: Hex, stateAnchor: SignerStateAnchor, now: number): boolean;
}

export type AmountObservation =
  | { kind: "exact"; value: bigint }
  | { kind: "upper-bound"; value: bigint }
  | { kind: "hidden" };

export type RecipientObservation =
  | { kind: "address"; address: Address }
  | { kind: "stealth"; derivedFrom: Hex }
  | { kind: "shielded"; boundTo?: Hex };

export type ReceiptHeader = Omit<Receipt, "adapterProof">;

export interface AdapterTrustRoots {
  [k: string]: unknown;
}

export interface VerifyContext {
  proofBytes: Hex;
  body: MandateBody;
  mandateHash: Hex;
  signerSubject: PartyRef;
  receipt: ReceiptHeader;
  now: number;
  trustRoots: AdapterTrustRoots;
}

export interface VerifyOutcome {
  ok: boolean;
  errorCode?: string;
  proofSatisfiedCapabilities: Hex[];
  amountObservation: AmountObservation;
  recipientObservation: RecipientObservation;
  tokenObserved?: { kind: "evm-address"; address: Address };
  chainIdObserved?: number;
  observationId?: Hex;
}

export interface AdapterProofSchema {
  verify(ctx: VerifyContext): Promise<VerifyOutcome>;
}

export interface ReorgPolicy {
  allowsAttempted: boolean;
  chainObservation: "required" | "not-applicable";
  disputeWindowMs?: number;
}

export type SchemaAdmission = "accept-new" | "accept-historical" | "accept-dispute-only";

export interface AdapterTrustEntry {
  address: Address;
  reorgPolicy: ReorgPolicy;
}

export interface SchemaRegistrationEntry {
  schema: AdapterProofSchema;
  allowedCapabilities: Hex[];
  admission: SchemaAdmission;
  trustRoots: AdapterTrustRoots;
  proofPayloadStore?: string;
}

export interface TrustAnchor {
  scheme: string;
  identifier: Hex;
  acceptedSchemaIds: Hex[];
}

export interface SignerProfileEntry {
  profile: SignerProfile;
  stateAnchor?: SignerStateAnchor;
}

export const adapterKey = (adapterId: Hex, adapterInstanceKey: Hex): string =>
  `${adapterId.toLowerCase()}:${adapterInstanceKey.toLowerCase()}`;
export const schemaKey = (adapterId: Hex, proofSchemaId: Hex): string =>
  `${adapterId.toLowerCase()}:${proofSchemaId.toLowerCase()}`;

export interface VerificationPolicy {
  verifyingContract: Address;
  acceptedVerifyingContracts: Set<string>;
  domainVersion?: string;

  signerProfiles: Map<Hex, SignerProfileEntry>;
  adapterTrust: Map<string, AdapterTrustEntry>;
  proofSchemas: Map<string, SchemaRegistrationEntry>;
  capabilityRegistry: Map<Hex, ParsedCapability>;
  issuerTrustAnchors: Map<Hex, TrustAnchor[]>;

  policyRequiredCapabilities?: Hex[];
  contextBindingScope: Map<Hex, "mandate" | "receipt">;
  auditorSubject?: PartyRef;
  evaluationTime: number;
}
