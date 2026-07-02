import { env } from "./env";
import { hspChain, HSP_CHAIN_NAMES, HSP_CONFIRMED_STABLECOINS, type SupportedChainKey } from "./chains";

/**
 * Trust configuration for the HSP sandbox deployment, as confirmed live on
 * 2026-06-26 at https://hsp-hackathon.hashkeymerchant.com (hashkey-testnet,
 * chainId 133). See hackathon_refs/hsp/sandbox_deployment/ for the full
 * verification trail.
 *
 * stablecoinAddress is now resolved per active chain from
 * HSP_CONFIRMED_STABLECOINS (chains.ts), cross-confirmed against @hsp/core's
 * own chain registry on 2026-06-27 - previously this was hard-coded to the
 * testnet-only address even when ACTIVE_CHAIN was mainnet, which would have
 * been silently wrong on a real mainnet run.
 *
 * These values are what WE pin when running our own HSPVerifier - per HSP's
 * trust model, the Coordinator's advertised config is never trusted blindly;
 * it is cross-checked against this pinned config via assertDeployment().
 */
export const HSP_SANDBOX_TRUST_CONFIG = {
  chain: env.HSP_CHAIN as SupportedChainKey,
  stablecoinAddress: HSP_CONFIRMED_STABLECOINS[env.HSP_CHAIN].address,
  // WARNING: verifyingContract below IS confirmed chain-agnostic (matches
  // @hsp/core's HSP_VERIFYING_CONTRACT constant across all chains, per
  // confirmed_facts.md). adapterAddress and policyHash, however, are ONLY
  // confirmed for the hashkey-testnet SANDBOX deployment we verified live -
  // we have NO confirmed mainnet equivalents for these two values. If
  // ACTIVE_CHAIN is ever set to hashkey-mainnet, these two values are
  // currently WRONG/UNVERIFIED placeholders, not real mainnet trust config.
  // Do not run a real mainnet payment flow until these are independently
  // confirmed against a real mainnet HSP Coordinator deployment.
  verifyingContract: "0x0000000000000000000000000000000000000001",
  adapterAddress: "0x467AaF355DF243379B961Ce00abBae20c1e25012",
  policyHash: "0xe1fff310d1a55fdd1a303b91e35a41a674948a23f2bc89477a354666f7ab48c6",
  trustedIssuers: {
    "attests:kyc:v1": [
      {
        issuerAddress: "0x087f7E5566c41BA4F321206b6671B382a4b91aC6",
        label: "HSP Mock Issuer (demo - no real compliance checks)",
      },
      {
        issuerAddress: env.NEXASH_ISSUER_ADDRESS,
        label: "Nexash Hackathon Developer Issuer",
      },
    ],
    "attests:sanctions:v1": [
      {
        issuerAddress: "0x087f7E5566c41BA4F321206b6671B382a4b91aC6",
        label: "HSP Mock Issuer (demo - no real compliance checks)",
      },
      {
        issuerAddress: env.NEXASH_ISSUER_ADDRESS,
        label: "Nexash Hackathon Developer Issuer",
      },
    ],
  },
} as const;

export const hspConfig = {
  coordinatorUrl: env.HSP_COORDINATOR_URL,
  apiKey: env.HSP_API_KEY,
  chainName: HSP_CHAIN_NAMES[env.HSP_CHAIN],
  chain: hspChain,
  trust: HSP_SANDBOX_TRUST_CONFIG,
} as const;

export const CAPABILITY = {
  KYC: "attests:kyc:v1",
  SANCTIONS: "attests:sanctions:v1",
} as const;

export type CapabilityKey = (typeof CAPABILITY)[keyof typeof CAPABILITY];

// bytes32-hashed versions for on-chain contract calls
import { keccak256, toBytes } from "viem";
export const CAPABILITY_BYTES32 = {
  KYC: keccak256(toBytes(CAPABILITY.KYC)) as `0x${string}`,
  SANCTIONS: keccak256(toBytes(CAPABILITY.SANCTIONS)) as `0x${string}`,
} as const;
