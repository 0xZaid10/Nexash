// Vendored from project-hsp/hsp packages/core/src/attestation/issuer.ts (Apache-2.0).

import { keccak256, stringToBytes, encodeAbiParameters, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { canonicalRefId, makeCap, type PartyRef, type Attestation } from "../core/index";
import { KYC_SCHEMA_ID, SANCTIONS_SCHEMA_ID, RISK_SCORE_SCHEMA_ID, ATTESTATION_SCHEMAS } from "./schemas";

const ZERO32: Hex = `0x${"00".repeat(32)}`;

export const ATTESTATION_TYPEHASH: Hex = keccak256(
  stringToBytes(
    "Attestation(bytes32 capabilityId,bytes32 schemaId,bytes32 claimsHash,bytes32 issuer,bytes32 issuerKeyId,bytes32 subjectBinding,bytes32 contextBinding,uint64 issuedAt,uint64 expiresAt)"
  )
);

export type UnsignedAttestation = Omit<Attestation, "issuerSignature">;

export function attestationStructHash(a: UnsignedAttestation): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint64" },
        { type: "uint64" },
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

export function evmIssuerPartyRef(address: Address): PartyRef {
  return { scheme: "evm-address", id: encodeAbiParameters([{ type: "address" }], [address]) };
}

export function evmIssuerKeyId(address: Address): Hex {
  return keccak256(encodeAbiParameters([{ type: "address" }], [address]));
}

export async function signAttestation(unsigned: UnsignedAttestation, issuerPrivateKey: Hex): Promise<Attestation> {
  const issuerSignature = await privateKeyToAccount(issuerPrivateKey).sign({ hash: attestationStructHash(unsigned) });
  return { ...unsigned, issuerSignature };
}

export interface IssueArgs {
  issuerPrivateKey: Hex;
  subject: PartyRef;
  issuedAt: number;
  expiresAt: number;
  contextBinding?: Hex;
}

async function issue(
  schemaId: Hex,
  capKey: string,
  capParams: Record<string, string>,
  claimsParams: Record<string, string>,
  args: IssueArgs
): Promise<Attestation> {
  const acct = privateKeyToAccount(args.issuerPrivateKey);
  const cap = makeCap(capKey, capParams);
  const claims = ATTESTATION_SCHEMAS[schemaId]!.encodeClaims(claimsParams);
  const unsigned: UnsignedAttestation = {
    capabilityId: cap.baseId,
    schemaId,
    claims,
    issuer: evmIssuerPartyRef(acct.address),
    issuerKeyId: evmIssuerKeyId(acct.address),
    subjectBinding: args.subject,
    contextBinding: args.contextBinding ?? ZERO32,
    issuedAt: args.issuedAt,
    expiresAt: args.expiresAt,
  };
  return signAttestation(unsigned, args.issuerPrivateKey);
}

export function issueKyc(args: IssueArgs & { level: "basic" | "full" }): Promise<Attestation> {
  return issue(KYC_SCHEMA_ID, "attests:kyc:v1", { level: args.level }, { level: args.level }, args);
}

export function issueSanctions(args: IssueArgs): Promise<Attestation> {
  return issue(SANCTIONS_SCHEMA_ID, "attests:sanctions:v1", {}, {}, args);
}

export function issueRiskScore(args: IssueArgs & { maxScore: number | bigint }): Promise<Attestation> {
  const ms = args.maxScore.toString();
  return issue(RISK_SCORE_SCHEMA_ID, "attests:risk-score:v1", { maxScore: ms }, { maxScore: ms }, args);
}
