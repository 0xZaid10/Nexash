// Vendored from project-hsp/hsp packages/core/src/policy/labels.ts (Apache-2.0).

import { formatCapability, type ParsedCapability } from "../core/capabilities";
import { EVM_TRANSFER_ADAPTER_ID } from "../adapter/mock-evm-transfer";
import { X402_ADAPTER_ID } from "../adapter/x402";
import { COMPLIANCE_REGISTRY_CAPS } from "./compliance";

const KNOWN_CAPS: ParsedCapability[] = [...COMPLIANCE_REGISTRY_CAPS];
const LABELS = new Map<string, string>();
for (const c of KNOWN_CAPS) {
  LABELS.set(c.id.toLowerCase(), formatCapability(c));
  LABELS.set(
    c.baseId.toLowerCase(),
    formatCapability({ ...c, ...(c.role ? { role: undefined } : {}) } as ParsedCapability)
  );
}

export function capLabel(id: string): string {
  return LABELS.get(id.toLowerCase()) ?? `${id.slice(0, 10)}…`;
}

export interface AdapterInfo {
  name: string;
  contributes: string[];
}

const ADAPTERS = new Map<string, AdapterInfo>([
  [EVM_TRANSFER_ADAPTER_ID.toLowerCase(), { name: "adapter:evm-transfer", contributes: [] }],
  [X402_ADAPTER_ID.toLowerCase(), { name: "adapter:x402", contributes: [] }],
]);

export function adapterInfo(adapterId: string): AdapterInfo {
  return ADAPTERS.get(adapterId.toLowerCase()) ?? { name: `${adapterId.slice(0, 10)}…`, contributes: [] };
}
