// Vendored from project-hsp/hsp packages/core/src/verifier/roles.ts (Apache-2.0).

import { decodeAbiParameters, encodeAbiParameters, getAddress, type Hex } from "viem";
import { RecipientKind, type Recipient, type SignedMandate, type PartyRef } from "../core/index";
import { type RoleName } from "../core/capabilities";
import type { SignerDecision, VerificationPolicy } from "./contracts";

export type RoleAssignment = Partial<Record<RoleName, PartyRef>>;

export function decodeRecipient(recipient: Recipient): PartyRef {
  if (recipient.kind === RecipientKind.ADDRESS) {
    const address = decodeAbiParameters([{ type: "address" }], recipient.payload)[0];
    return { scheme: "evm-address", id: encodeAbiParameters([{ type: "address" }], [getAddress(address)]) };
  }
  const commitment = decodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], recipient.payload)[0];
  return { scheme: "stealth-commitment", id: commitment };
}

export function roleFunction(
  mandate: SignedMandate,
  signerDecision: SignerDecision,
  policy: VerificationPolicy
): RoleAssignment {
  const assignment: RoleAssignment = {
    payer: signerDecision.resolvedSubject,
    payee: decodeRecipient(mandate.body.recipient),
  };
  if (policy.auditorSubject) assignment.auditor = policy.auditorSubject;
  return assignment;
}
