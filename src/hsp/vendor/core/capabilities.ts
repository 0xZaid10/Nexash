// Vendored from project-hsp/hsp packages/core/src/core/capabilities.js (Apache-2.0).
// Workspace-private package, not on npm - vendored verbatim, not reimplemented.

import { capabilityId, type CanonicalParam, type CapabilityIdInput, type ParamType } from "../derivations";
import { keccak256, encodeAbiParameters, type Hex } from "viem";

export const Roles = { payer: "payer", payee: "payee", auditor: "auditor" } as const;
export type RoleName = (typeof Roles)[keyof typeof Roles];
const ROLE_NAMES = new Set<string>(Object.values(Roles));

export type ParamOrder = "monotone-asc-enum" | "monotone-desc-numeric";

export interface ParamSchema {
  name: string;
  type: ParamType;
  order?: ParamOrder;
  enumValues?: string[];
}

export interface CapFamily {
  namespace: string;
  name: string;
  version: string;
  params: ParamSchema[];
}

export const familyKey = (ns: string, name: string, version: string): string => `${ns}:${name}:${version}`;

export const BASELINE_CAP_FAMILIES: Record<string, CapFamily> = (() => {
  const f = (namespace: string, name: string, params: ParamSchema[] = [], version = "v1"): CapFamily => ({
    namespace,
    name,
    version,
    params,
  });
  const families: CapFamily[] = [
    f("hides", "sender"),
    f("hides", "recipient"),
    f("hides", "amount"),
    f("discloses", "viewing-key", [{ name: "viewer", type: "string" }]),
    f("discloses", "selective-fields", [{ name: "schemaHash", type: "bytes32" }]),
    f("attests", "sanctions"),
    f("attests", "kyc", [
      { name: "level", type: "string", order: "monotone-asc-enum", enumValues: ["basic", "full"] },
    ]),
    f("attests", "travel-rule"),
    f("attests", "risk-score", [{ name: "maxScore", type: "uint256", order: "monotone-desc-numeric" }]),
    f("attests", "source-of-funds", [{ name: "proofKind", type: "string" }]),
    f("attests", "disclosure", [{ name: "kind", type: "string" }]),
    f("proves", "source-of-funds"),
    f("proves", "association-set", [
      { name: "setRoot", type: "bytes32" },
      { name: "setMonotone", type: "bool" },
      { name: "setAuthority", type: "bytes32" },
    ]),
    f("proves", "recipient-frontrun-safe", [{ name: "mode", type: "string" }]),
    f("proves", "quote-honored", [{ name: "quoteHash", type: "bytes32" }]),
    f("proves", "settlement-verified", [{ name: "via", type: "string" }]),
  ];
  const reg: Record<string, CapFamily> = {};
  for (const fam of families) reg[familyKey(fam.namespace, fam.name, fam.version)] = fam;
  return reg;
})();

export type CapRegistry = Record<string, CapFamily>;

export interface CapParam {
  key: string;
  type: ParamType;
  value: string | boolean;
}

export interface ParsedCapability {
  role?: RoleName;
  namespace: string;
  name: string;
  version: string;
  params: CapParam[];
  baseId: Hex;
  id: Hex;
}

export function roleWrap(roleName: RoleName, capId: Hex): Hex {
  return keccak256(
    encodeAbiParameters([{ type: "string" }, { type: "string" }, { type: "bytes32" }], ["role", roleName, capId])
  );
}

function coerceParam(ps: ParamSchema, raw: string | bigint | boolean): string | boolean {
  switch (ps.type) {
    case "bool":
      if (typeof raw === "boolean") return raw;
      if (raw === "true") return true;
      if (raw === "false") return false;
      throw new Error(`param "${ps.name}": bool must be true|false, got ${String(raw)}`);
    case "uint256":
      return BigInt(String(raw)).toString();
    case "string": {
      const v = String(raw);
      if (ps.order === "monotone-asc-enum" && ps.enumValues && !ps.enumValues.includes(v)) {
        throw new Error(`param "${ps.name}": "${v}" not in enum [${ps.enumValues.join(", ")}]`);
      }
      return v;
    }
    case "bytes32":
    case "address": {
      const v = String(raw);
      if (!v.startsWith("0x")) throw new Error(`param "${ps.name}": ${ps.type} must be 0x-hex, got ${v}`);
      return v;
    }
  }
}

function buildFromFamily(
  family: CapFamily,
  raw: Record<string, string | bigint | boolean>
): { params: CapParam[]; baseId: Hex } {
  const params: CapParam[] = [];
  for (const ps of family.params) {
    if (!(ps.name in raw)) {
      throw new Error(`${familyKey(family.namespace, family.name, family.version)}: missing param "${ps.name}"`);
    }
    params.push({ key: ps.name, type: ps.type, value: coerceParam(ps, raw[ps.name]!) });
  }
  for (const k of Object.keys(raw)) {
    if (!family.params.some((p) => p.name === k)) {
      throw new Error(`${familyKey(family.namespace, family.name, family.version)}: unknown param "${k}"`);
    }
  }
  const canon: CanonicalParam[] = params.map((p) => ({ key: p.key, type: p.type, value: p.value }));
  const input: CapabilityIdInput = {
    namespace: family.namespace,
    name: family.name,
    version: family.version,
    params: canon,
  };
  return { params, baseId: capabilityId(input) };
}

export function makeCap(
  familyOrKey: string | CapFamily,
  paramValues: Record<string, string | bigint | boolean> = {},
  role?: RoleName,
  registry: CapRegistry = BASELINE_CAP_FAMILIES
): ParsedCapability {
  const family = typeof familyOrKey === "string" ? registry[familyOrKey] : familyOrKey;
  if (!family) throw new Error(`HSP-CAP-UNKNOWN: ${String(familyOrKey)}`);
  const { params, baseId } = buildFromFamily(family, paramValues);
  return {
    role,
    namespace: family.namespace,
    name: family.name,
    version: family.version,
    params,
    baseId,
    id: role ? roleWrap(role, baseId) : baseId,
  };
}

export function canonicalizeCapSet(ids: Hex[]): Hex[] {
  const norm = ids.map((i) => i.toLowerCase() as Hex);
  return Array.from(new Set(norm)).sort();
}

export function dominates(
  required: ParsedCapability,
  candidate: ParsedCapability,
  registry: CapRegistry = BASELINE_CAP_FAMILIES
): boolean {
  if (
    required.namespace !== candidate.namespace ||
    required.name !== candidate.name ||
    required.version !== candidate.version
  ) {
    return false;
  }
  const family = registry[familyKey(required.namespace, required.name, required.version)];
  if (!family) return false;

  const rMap = new Map(required.params.map((p) => [p.key, p]));
  const cMap = new Map(candidate.params.map((p) => [p.key, p]));
  if (rMap.size !== cMap.size) return false;

  for (const ps of family.params) {
    const r = rMap.get(ps.name);
    const c = cMap.get(ps.name);
    if (!r || !c) return false;
    if (ps.order === "monotone-asc-enum") {
      const e = ps.enumValues ?? [];
      const ri = e.indexOf(String(r.value));
      const ci = e.indexOf(String(c.value));
      if (ri < 0 || ci < 0 || ci < ri) return false;
    } else if (ps.order === "monotone-desc-numeric") {
      if (BigInt(String(c.value)) > BigInt(String(r.value))) return false;
    } else if (String(r.value) !== String(c.value)) {
      return false;
    }
  }
  return true;
}

export function capSatisfies(
  required: ParsedCapability,
  candidate: ParsedCapability,
  registry: CapRegistry = BASELINE_CAP_FAMILIES
): boolean {
  if (required.baseId === candidate.baseId) return true;
  const family = registry[familyKey(required.namespace, required.name, required.version)];
  if (!family || !family.params.some((p) => p.order)) return false;
  return dominates(required, candidate, registry);
}

export function familyCapId(familyOrKey: string | CapFamily, registry: CapRegistry = BASELINE_CAP_FAMILIES): Hex {
  const family = typeof familyOrKey === "string" ? registry[familyOrKey] : familyOrKey;
  if (!family) throw new Error(`HSP-CAP-UNKNOWN: ${String(familyOrKey)}`);
  return capabilityId({ namespace: family.namespace, name: family.name, version: family.version, params: [] });
}

export function buildCapabilityRegistry(caps: ParsedCapability[]): Map<Hex, ParsedCapability> {
  const m = new Map<Hex, ParsedCapability>();
  for (const c of caps) m.set(c.id, c);
  return m;
}

export function formatCapability(cap: ParsedCapability): string {
  const base = `${cap.namespace}:${cap.name}:${cap.version}`;
  const params = cap.params.map((p) => `${p.key}=${p.value}`).join(",");
  const withParams = params ? `${base}[${params}]` : base;
  return cap.role ? `${withParams}@${cap.role}` : withParams;
}
