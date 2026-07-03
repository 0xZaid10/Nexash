import { createPublicClient, createWalletClient, http, type Hash } from "viem";
import { activeChain } from "../config/chains";
import { env } from "../config/env";
import { issuerKeystore } from "../issuer/keystore";
import attestationRegistryAbi from "./abi/AttestationRegistry.json";

const publicClient = createPublicClient({ chain: activeChain, transport: http() });

/**
 * FIXED - SIGNER MISMATCH RESOLVED: this previously used the general
 * BACKEND_SIGNER (operator) account, which would have reverted on-chain
 * with NotIssuer - AttestationRegistry.recordAttestation is `onlyIssuer`,
 * and the operator address is not registered as an issuer (only
 * NEXASH_ISSUER_ADDRESS is, via contracts/script/Configure.s.sol). This
 * now correctly signs with issuerKeystore's own account - the same address
 * already registered as an issuer on-chain and the same one registered as
 * "Hackathon Developer Issuer" in the HSP sandbox.
 */
const issuerWalletClient = createWalletClient({
  chain: activeChain,
  transport: http(),
  account: issuerKeystore.getSigner(),
});

const REGISTRY_ADDRESS = env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`;

export interface OnChainAttestation {
  subject: `0x${string}`;
  capability: Hash;
  issuer: `0x${string}`;
  reportTxHash: Hash;
  taskId: Hash;
  kycLevel: number;
  issuedAt: bigint;
  expiresAt: bigint;
  revoked: boolean;
}

/**
 * Anchors an issuer-signed attestation on-chain. The signing of the
 * off-chain HSP attestation already happened in issuer/issuerService.ts -
 * this function ONLY writes that already-verified result to
 * AttestationRegistry. It does not re-verify anything; issuerService is
 * the gate, this is the anchor.
 *
 * Signs with issuerWalletClient (see fix note above) - the same address
 * registered as an issuer on this contract via Configure.s.sol.
 */
export async function recordAttestationOnChain(params: {
  subject: `0x${string}`;
  capability: Hash;
  reportTxHash: Hash;
  taskId: Hash;
  kycLevel: number;
  expiresAt: number;
}): Promise<Hash> {
  const txHash = await issuerWalletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: attestationRegistryAbi,
    functionName: "recordAttestation",
    args: [
      params.subject,
      params.capability,
      params.reportTxHash,
      params.taskId,
      params.kycLevel,
      BigInt(params.expiresAt),
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function isAttestationValid(
  subject: `0x${string}`,
  capability: Hash
): Promise<boolean> {
  return publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: attestationRegistryAbi,
    functionName: "isValid",
    args: [subject, capability],
  }) as Promise<boolean>;
}

export async function isAttestationValidWithMinLevel(
  subject: `0x${string}`,
  capability: Hash,
  minKycLevel: number
): Promise<boolean> {
  return publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: attestationRegistryAbi,
    functionName: "isValidWithMinLevel",
    args: [subject, capability, minKycLevel],
  }) as Promise<boolean>;
}

export async function getOnChainAttestation(
  subject: `0x${string}`,
  capability: Hash
): Promise<OnChainAttestation> {
  return publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: attestationRegistryAbi,
    functionName: "getAttestation",
    args: [subject, capability],
  }) as Promise<OnChainAttestation>;
}
