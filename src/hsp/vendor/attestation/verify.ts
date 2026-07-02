// Vendored from project-hsp/hsp packages/core/src/attestation/verify.ts (Apache-2.0).

import { recoverAddress, type Hex } from "viem";
import { partyRefEqual, type Attestation, type PartyRef } from "../core/index";
import { attestationStructHash, evmIssuerKeyId } from "./issuer";
import type { TrustAnchor } from "../verifier/contracts";

const ZERO32: Hex = `0x${"00".repeat(32)}`;

export interface CR2Result {
  ok: boolean;
  code?: string;
}

export async function validateCR2(
  entry: Attestation,
  expectedSubject: PartyRef | undefined,
  anchors: TrustAnchor[],
  now: number,
  mandateHash: Hex,
  receiptHash: Hex,
  contextScope: "mandate" | "receipt" | undefined
): Promise<CR2Result> {
  let signer: Hex;
  try {
    signer = await recoverAddress({ hash: attestationStructHash(entry), signature: entry.issuerSignature });
  } catch {
    return { ok: false, code: "HSP-ATT-INVALID" };
  }
  if (evmIssuerKeyId(signer).toLowerCase() !== entry.issuerKeyId.toLowerCase()) {
    return { ok: false, code: "HSP-ATT-INVALID" };
  }

  const trusted = anchors.some(
    (an) =>
      an.identifier.toLowerCase() === entry.issuerKeyId.toLowerCase() &&
      an.acceptedSchemaIds.some((s) => s.toLowerCase() === entry.schemaId.toLowerCase())
  );
  if (!trusted) return { ok: false, code: "HSP-ATT-ISSUER-UNTRUSTED" };

  if (!expectedSubject || !partyRefEqual(entry.subjectBinding, expectedSubject)) {
    return { ok: false, code: "HSP-ATT-INVALID" };
  }

  if (now < entry.issuedAt || (entry.expiresAt !== 0 && now > entry.expiresAt)) {
    return { ok: false, code: "HSP-ATT-INVALID" };
  }

  const cb = entry.contextBinding.toLowerCase();
  const inSet = cb === ZERO32 || cb === mandateHash.toLowerCase() || cb === receiptHash.toLowerCase();
  if (!inSet) return { ok: false, code: "HSP-ATT-INVALID" };
  if (contextScope === "mandate" && cb !== mandateHash.toLowerCase()) return { ok: false, code: "HSP-ATT-INVALID" };
  if (contextScope === "receipt" && cb !== receiptHash.toLowerCase()) return { ok: false, code: "HSP-ATT-INVALID" };

  return { ok: true };
}
