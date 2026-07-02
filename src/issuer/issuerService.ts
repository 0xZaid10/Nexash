import type { Hash } from "viem";
import { env } from "../config/env";
import { issuerKeystore } from "./keystore";
import {
  attestationStructHash,
  evmAddressPartyRef,
  evmIssuerKeyId,
  mapNumericLevelToHspLevel,
  ZERO32,
  KYC_CAPABILITY_ID,
  KYC_FULL_CAPABILITY_ID,
  type UnsignedAttestation,
  type SignedAttestation,
  type HspKycLevel,
} from "./schema";
import { signAttestation } from "../hsp/vendor/attestation/issuer";
import { ATTESTATION_SCHEMAS, KYC_SCHEMA_ID } from "../hsp/vendor/attestation/schemas";
import { verifyKycReportBeforeIssuing, type VerifiedKycAttestation } from "./nexaidVerifier";
import { nexaidConfig } from "../config/nexaid";

const DEFAULT_ATTESTATION_VALIDITY_SECONDS = 90 * 24 * 60 * 60;

export interface IssueKycRequest {
  subject: `0x${string}`;
  reportTxHash: Hash;
  taskId: string;
  templateId: string;
}

export interface IssueKycResult {
  /**
   * The real, HSP-shaped signed attestation (raw structHash signature,
   * level: 'basic'|'full') - this is what would be submitted alongside a
   * Mandate for HSP's own verifier to check, IF the placeholder schema/
   * capability IDs above were replaced with the real vendored values first.
   */
  hspAttestation: SignedAttestation;
  hspLevel: HspKycLevel;
  /**
   * OUR OWN numeric kycLevel (0-4), for AttestationRegistry.sol's
   * recordAttestation() call - a completely separate shape/audience from
   * hspAttestation above. See schema.ts's top comment for why both exist.
   */
  ourNumericKycLevel: number;
  verification: VerifiedKycAttestation;
}

/**
 * The single entry point for issuing a KYC attestation from a verified
 * NexaID report. This is intentionally the ONLY function in the backend
 * that calls issuerKeystore.getSigner() to produce a signature - everything
 * upstream (nexaidVerifier) only gathers evidence, never signs anything.
 *
 * Order of operations matters: we verify FIRST, sign SECOND. If verification
 * throws, no signature is ever produced - there is no code path that signs
 * an attestation we have not independently confirmed.
 *
 * Produces TWO outputs from one verification, deliberately: HSP's own
 * wire-format attestation (raw digest signature, basic/full) for HSP's
 * verifier, and our numeric kycLevel for our own AttestationRegistry -
 * these serve different audiences and must not be collapsed into one shape.
 */
export async function issueKycAttestationDirect(params: {
  subject: `0x${string}`;
  kycLevel: number;
}): Promise<IssueKycResult> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + DEFAULT_ATTESTATION_VALIDITY_SECONDS;
  const hspLevel = mapNumericLevelToHspLevel(params.kycLevel);

  const issuerAddress = issuerKeystore.address;
  const subjectRef = evmAddressPartyRef(params.subject);
  const issuerRef = evmAddressPartyRef(issuerAddress);
  const claimsBytes = ATTESTATION_SCHEMAS[KYC_SCHEMA_ID].encodeClaims({ level: hspLevel });

  const unsigned: UnsignedAttestation = {
    capabilityId: KYC_FULL_CAPABILITY_ID,
    schemaId: KYC_SCHEMA_ID,
    claims: claimsBytes,
    issuer: issuerRef,
    issuerKeyId: evmIssuerKeyId(issuerAddress),
    subjectBinding: subjectRef,
    contextBinding: ZERO32,
    issuedAt,
    expiresAt,
  };

  const signed = await signAttestation(unsigned, env.NEXASH_ISSUER_PRIVATE_KEY as `0x${string}`);
  return { hspAttestation: signed, hspLevel };
}

export async function issueKycAttestation(request: IssueKycRequest): Promise<IssueKycResult> {
  const verification = await verifyKycReportBeforeIssuing({
    subject: request.subject,
    reportTxHash: request.reportTxHash,
    taskId: request.taskId,
    templateId: request.templateId,
  });

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + DEFAULT_ATTESTATION_VALIDITY_SECONDS;

  // taskId's real format from NexaID is not yet confirmed (see
  // nexaidVerifier.ts verification-status notes). Validate it actually
  // looks like 32-byte hex before treating it as bytes32 - a blind cast
  // here would silently produce a malformed structHash input if NexaID's
  // taskId turns out to be a different shape (e.g. a UUID).
  const taskIdHex = verification.taskId;
  if (!/^0x[0-9a-fA-F]{64}$/.test(taskIdHex)) {
    throw new Error(
      `taskId "${taskIdHex}" is not a 32-byte hex string. NexaID's actual ` +
        `taskId format must be confirmed and this claims-building logic ` +
        `updated accordingly before issuing real attestations.`
    );
  }

  const hspLevel = mapNumericLevelToHspLevel(verification.kycLevel);

  const issuerAddress = issuerKeystore.address;
  const subjectRef = evmAddressPartyRef(verification.subject);
  const issuerRef = evmAddressPartyRef(issuerAddress);

  // REPLACED 2026-06-27: previously a JSON.stringify+hex-encode guess. Now
  // uses the REAL, vendored encodeClaims from @hsp/core's
  // ATTESTATION_SCHEMAS[KYC_SCHEMA_ID] - confirmed exact encoding
  // (encodeAbiParameters(['string'], [level])).
  const claimsBytes = ATTESTATION_SCHEMAS[KYC_SCHEMA_ID].encodeClaims({ level: hspLevel });

  const unsigned: UnsignedAttestation = {
    capabilityId: KYC_FULL_CAPABILITY_ID,
    schemaId: KYC_SCHEMA_ID,
    claims: claimsBytes,
    issuer: issuerRef,
    issuerKeyId: evmIssuerKeyId(issuerAddress),
    subjectBinding: subjectRef,
    contextBinding: ZERO32,
    issuedAt,
    expiresAt,
  };

  const digest = attestationStructHash(unsigned);

  // Raw digest signature - NOT signTypedData(). This matches @hsp/core's
  // signAttestation(): privateKeyToAccount(key).sign({ hash: structHash }).
  const issuerSignature = await issuerKeystore.getSigner().sign({ hash: digest });

  const hspAttestation: SignedAttestation = { ...unsigned, issuerSignature };

  return {
    hspAttestation,
    hspLevel,
    ourNumericKycLevel: verification.kycLevel,
    verification,
  };
}

export function getIssuerAddress(): `0x${string}` {
  return issuerKeystore.address;
}

export function getCanonicalKycTemplateId(): string {
  return nexaidConfig.kycTemplate.templateId;
}
