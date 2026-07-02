import type { Hash, Address } from "viem";
import type { SignedMandate, Receipt, Attestation } from "./vendor/core/types";

// CONSOLIDATED 2026-06-27: re-export the real vendored types instead of
// maintaining a parallel, structurally-similar-but-distinct copy. Previously
// this file independently redefined SignedMandate/Receipt/Attestation,
// which silently diverged from vendor/core/types.ts - fixed.
export type {
  Domain,
  Signer,
  Recipient,
  MandateBody,
  SignedMandate,
  Receipt,
  Attestation,
  PartyRef,
  OutcomeValue,
} from "./vendor/core/types";
export { RecipientKind, Outcome } from "./vendor/core/types";
export type { OutcomeClass, AcceptDecision } from "./vendor/verifier/contracts";

export type PaymentStatus = "PROPOSED" | "ATTEMPTED" | "SETTLED" | "FAILED" | "DISPUTED" | "EXPIRED";

// Our own wrapper around the Coordinator's GET /payments/:id response shape -
// not a protocol type, just how we model the HTTP response.
export interface PaymentRecord {
  paymentId: Hash;
  status: PaymentStatus;
  mandate: SignedMandate;
  receipts: { receipt: Receipt }[];
  attestations: Attestation[];
}

export interface DeploymentInfo {
  chain: string;
  chainId: number;
  stablecoinAddress: Address;
  adapterAddress: Address;
  policyHash: Hash;
}
