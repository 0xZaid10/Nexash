import { defineChain } from "viem";
import { env } from "./env";

export const hashkeyMainnet = defineChain({
  id: 177,
  name: "HashKey Chain",
  network: "hashkey-mainnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: [env.HASHKEY_MAINNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "HashKey Explorer", url: "https://hashkey.blockscout.com" },
  },
});

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  network: "hashkey-testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: [env.HASHKEY_TESTNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "HashKey Testnet Explorer", url: "https://testnet-explorer.hsk.xyz" },
  },
  testnet: true,
});

export type SupportedChainKey = "hashkey-mainnet" | "hashkey-testnet";

export const CHAINS: Record<SupportedChainKey, ReturnType<typeof defineChain>> = {
  "hashkey-mainnet": hashkeyMainnet,
  "hashkey-testnet": hashkeyTestnet,
};

export const activeChain = CHAINS[env.ACTIVE_CHAIN];
export const hspChain = CHAINS[env.HSP_CHAIN];

export function resolveChain(key: SupportedChainKey) {
  const chain = CHAINS[key];
  if (!chain) {
    throw new Error(`Unsupported chain key: ${key}`);
  }
  return chain;
}

// HSP protocol only recognizes these two HashKey chain identifiers, plus
// ethereum mainnet and a local anvil-dev chain (not relevant to Nexash).
// See: hackathon_refs/hsp/README.md "Chains" section.
export const HSP_CHAIN_NAMES: Record<SupportedChainKey, string> = {
  "hashkey-mainnet": "hashkey",
  "hashkey-testnet": "hashkey-testnet",
};

// HSP CHAIN_DEFAULTS (packages/core/src/chains/index.ts), confirmed
// 2026-06-27 directly from @hsp/core source. Stablecoin addresses below are
// what HSP itself trusts per chain - cross-check against these, not just
// our own assumptions, when constructing Mandates or pinning trust config.
export const HSP_CONFIRMED_STABLECOINS: Record<
  SupportedChainKey,
  { address: `0x${string}`; symbol: string; decimals: number }
> = {
  "hashkey-mainnet": {
    // Previously MISSING ENTIRELY from our config - we only ever had a
    // testnet stablecoin address. Confirmed from @hsp/core source
    // (RPC-verified by the HSP team themselves, per their own code comment
    // dated 2026-06-10).
    address: "0x054ed45810DbBAb8B27668922D110669c9D88D0a",
    symbol: "USDC.e",
    decimals: 6,
  },
  "hashkey-testnet": {
    // Matches what we already had pinned from the live HSP sandbox page -
    // cross-confirmed independently by @hsp/core source.
    address: "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6",
    symbol: "USDC",
    decimals: 6,
  },
};
