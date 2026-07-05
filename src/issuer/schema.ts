import { keccak256, stringToBytes, encodeAbiParameters, type Hex, type Address } from "viem";
import { KYC_SCHEMA_ID, SANCTIONS_SCHEMA_ID, ATTESTATION_SCHEMAS } from "../hsp/vendor/attestation/schemas";
import { makeCap } from "../hsp/vendor/core/capabilities";

/**
 * REWRITTEN 2026-06-27 against confirmed ground truth from
 * packages/core/src/attestation/issuer.ts (@hsp/core source, directly read).
 * The PREVIOUS version of this file modeled HSP attestations as EIP-712
 * typed data with a numeric kycLevel - BOTH of those were wrong:
 *
 * 1. HSP attestations are NOT EIP-712 typed data. They are a raw keccak256
 *    structHash (ATTESTATION_TYPEHASH + abi-encoded fields), signed via a
 *    raw digest signature (account.sign({ hash }), not signTypedData()).
 * 2. issueKyc() takes level: 'basic' | 'full' - a two-value string enum,
 *    NOT a numeric 0-4 tier. Our own AttestationRegistry.sol's numeric
 *    kycLevel (uint8, NONE..ULTIMATE) is UNCHANGED and still valid - it is
 *    OUR OWN on-chain anchor's shape, independent of HSP's wire format. The
 *    two are deliberately different models for two different audiences;
 *    issuerService.ts is responsible for producing BOTH shapes from one
 *    underlying NexaID verification, not collapsing them into one.
 *
 * This file mirrors packages/core/src/attestation/issuer.ts's actual
 * exported shapes (ATTESTATION_TYPEHASH, attestationStructHash, PartyRef
 * pattern) rather than inventing our own - vendoring proper, not guessing.
 */

export const ATTESTATION_TYPEHASH: Hex = keccak256(
  stringToBytes(
    "Attestation(bytes32 capabilityId,bytes32 schemaId,bytes32 claimsHash,bytes32 issuer,bytes32 issuerKeyId,bytes32 subjectBinding,bytes32 contextBinding,uint64 issuedAt,uint64 expiresAt)"
  )
);

export const ZERO32: Hex = `0x${"00".repeat(32)}` as Hex;

/**
 * PartyRef - HSP's identity-reference pattern. Mirrors
 * evmAddressPartyRef()/evmIssuerPartyRef() from @hsp/core: { scheme:
 * "evm-address", id: abi.encode(address) }.
 */
export interface PartyRef {
  scheme: string;
  id: Hex;
}

export function evmAddressPartyRef(address: Address): PartyRef {
  return { scheme: "evm-address", id: encodeAbiParameters([{ type: "address" }], [address]) };
}

/**
 * Deterministic issuerKeyId fingerprint for an evm-key issuer - matches
 * @hsp/core's evmIssuerKeyId() exactly: keccak256(abi.encode(address)), NOT
 * just the raw address as our previous version assumed.
 */
export function evmIssuerKeyId(address: Address): Hex {
  return keccak256(encodeAbiParameters([{ type: "address" }], [address]));
}

/**
 * canonicalRefId - HSP hashes a PartyRef before including it in the
 * structHash. We do not have @hsp/core's exact canonicalRefId()
 * implementation vendored yet (see vendoring TODO) - this is a
 * best-effort mirror (hash the scheme + id together) and MUST be
 * cross-checked against the real implementation before this signs
 * anything that needs to be ACCEPTED by HSP's own verifier. Until then,
 * treat any signature produced via this file as UNVERIFIED against the
 * real protocol - safe to use for our OWN AttestationRegistry anchor
 * (which never calls this), unsafe to assume HSP's Coordinator will accept.
 */
export function canonicalRefId(ref: PartyRef): Hex {
  return keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes" }], [ref.scheme, ref.id]));
}

export interface UnsignedAttestation {
  capabilityId: Hex;
  schemaId: Hex;
  claims: Hex; // raw bytes, opaque - gets keccak256'd, never decoded as a struct
  issuer: PartyRef;
  issuerKeyId: Hex;
  subjectBinding: PartyRef;
  contextBinding: Hex;
  issuedAt: number;
  expiresAt: number; // 0 = no expiry
}

/**
 * structHash the issuer signs - mirrors attestationStructHash() from
 * @hsp/core exactly (field order, types, canonicalRefId calls).
 */
export function attestationStructHash(a: UnsignedAttestation): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" }, // ATTESTATION_TYPEHASH
        { type: "bytes32" }, // capabilityId
        { type: "bytes32" }, // schemaId
        { type: "bytes32" }, // claimsHash
        { type: "bytes32" }, // issuer (canonicalRefId)
        { type: "bytes32" }, // issuerKeyId
        { type: "bytes32" }, // subjectBinding (canonicalRefId)
        { type: "bytes32" }, // contextBinding
        { type: "uint64" }, // issuedAt
        { type: "uint64" }, // expiresAt
      ],
      [
        ATTESTATION_TYPEHASH,
        a.capabilityId,
        a.schemaId,
        keccak256(a.claims),
        canonicalRefId(a.issuer),
        a.issuerKeyId,
        canonicalRefId(a.subjectBinding),
        a.contextBinding,
        BigInt(a.issuedAt),
        BigInt(a.expiresAt),
      ]
    )
  );
}

export interface SignedAttestation extends UnsignedAttestation {
  issuerSignature: Hex;
}

/**
 * REPLACED 2026-06-27: previously hand-guessed keccak256 hashes of the
 * capability key strings. Now using the REAL, vendored KYC_SCHEMA_ID /
 * SANCTIONS_SCHEMA_ID from @hsp/core's attestation/schemas.ts - confirmed
 * exact values, not guesses.
 *
 * NOTE: schemaId and capabilityId are CONFIRMED DIFFERENT hashes in HSP's
 * model (see hackathon_refs/hsp/core_source_truth/confirmed_facts.md) -
 * what is used below for BOTH capabilityId and schemaId fields is actually
 * only correct for schemaId. The real capabilityId requires @hsp/core's
 * makeCap() (core/capabilities.js, not yet vendored - the one remaining
 * unresolved piece). Until that's vendored, capabilityId below is still a
 * stand-in (reusing schemaId's value), not yet the real capabilityId.
 */
export const KYC_CAPABILITY_ID: Hex = makeCap("attests:kyc:v1", { level: "basic" }).baseId;
export const KYC_FULL_CAPABILITY_ID: Hex = makeCap("attests:kyc:v1", { level: "full" }).baseId;
export const SANCTIONS_CAPABILITY_ID: Hex = makeCap("attests:sanctions:v1", {}).baseId;

export const KYC_CAPABILITY_ID_PLACEHOLDER = KYC_CAPABILITY_ID;
export const SANCTIONS_CAPABILITY_ID_PLACEHOLDER = SANCTIONS_CAPABILITY_ID;

export type HspKycLevel = "basic" | "full";

/**
 * Maps OUR OWN numeric kycLevel (0-4, used in AttestationRegistry.sol and
 * throughout our backend) to HSP's two-value string enum. This mapping is
 * a DESIGN DECISION we are making, not something confirmed from HSP's
 * source - HSP does not define what "basic" vs "full" means relative to a
 * 0-4 scale; that correspondence is ours to define and document.
 * Currently: levels 0-2 => 'basic', levels 3-4 => 'full'. Revisit if this
 * mapping does not match how NexaID's passKycLevel values actually
 * distribute in practice.
 */
export function mapNumericLevelToHspLevel(numericLevel: number): HspKycLevel {
  return numericLevel >= 3 ? "full" : "basic";
}
