// Vendored from project-hsp/hsp packages/core/src/adapter/x402.ts (Apache-2.0).
// Only the shared adapterId + merchant-domain instanceKey - the conformant
// proof schema lives in x402-exact.ts (not vendored, not needed - we have
// no x402 payment flows planned). Vendored here only because labels.ts
// imports X402_ADAPTER_ID for its adapter-name lookup table.

import { keccak256, stringToBytes, type Hex } from "viem";

export const X402_ADAPTER_ID: Hex = keccak256(stringToBytes("adapter:x402"));

export function x402InstanceKey(merchantDomain: string): Hex {
  return keccak256(stringToBytes(merchantDomain.toLowerCase()));
}
