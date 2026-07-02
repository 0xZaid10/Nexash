// Vendored from project-hsp/hsp packages/core/src/verifier/index.ts (Apache-2.0).

import { recoverAddress, decodeAbiParameters, getAddress, type Hex, type Address } from "viem";
import {
  mandateHash as computeMandateHash,
  requiredCapabilitiesHash as computeReqCapsHash,
  receiptHash as computeReceiptHash,
  canonicalizeCapSet,
  makeCap,
  capSatisfies,
  familyCapId,
  Outcome,
  RecipientKind,
  type OutcomeValue,
  type SignedMandate,
  type Receipt,
  type Attestation,
  type MandateBody,
  type DomainInput,
  type ParsedCapability,
  type PartyRef,
} from "../core/index";
import { ATTESTATION_SCHEMAS } from "../attestation/schemas";
import { validateCR2 } from "../attestation/verify";
import type {
  VerificationPolicy,
  AcceptDecision,
  OutcomeClass,
  SignerDecision,
  VerifyOutcome,
  VerifyContext,
  ReceiptHeader,
  AdapterTrustEntry,
  SchemaAdmission,
} from "./contracts";
import { adapterKey, schemaKey } from "./contracts";
import { roleFunction, type RoleAssignment } from "./roles";
import { outcomeClassForOk } from "./outcome";
import { SeqIndex, ObservationIndex, type PriorState } from "./seq-index";

function reject(outcomeClass: OutcomeClass, errorCode: string, errorDetail?: string): AcceptDecision {
  return { ok: false, outcomeClass, errorCode, errorDetail };
}

function domainFor(body: MandateBody, policy: VerificationPolicy): DomainInput {
  return {
    name: "HSP",
    version: policy.domainVersion ?? "1",
    chainId: Number(body.chainId),
    verifyingContract: policy.verifyingContract,
  };
}

export interface PhaseAResult {
  domain: DomainInput;
  mandateHash: Hex;
  signerDecision: SignerDecision;
  roleAssignment: RoleAssignment;
}

export async function verifyPhaseA(
  mandate: SignedMandate,
  policy: VerificationPolicy
): Promise<{ ok: true; result: PhaseAResult } | { ok: false; decision: AcceptDecision }> {
  const body = mandate.body;
  const now = policy.evaluationTime;

  if (Number(body.chainId) === 0) return { ok: false, decision: reject("PERMANENT", "HSP-MAND-CHAINID") };
  if (!policy.acceptedVerifyingContracts.has(policy.verifyingContract.toLowerCase())) {
    return { ok: false, decision: reject("POLICY", "HSP-MAND-DOMAIN", "verifyingContract not accepted") };
  }
  const domain = domainFor(body, policy);

  const canon = canonicalizeCapSet(mandate.requiredCapabilities);
  if (computeReqCapsHash(canon) !== body.requiredCapabilitiesHash) {
    return { ok: false, decision: reject("PERMANENT", "HSP-MAND-REQHASH-MISMATCH") };
  }

  if (policy.policyRequiredCapabilities && policy.policyRequiredCapabilities.length > 0) {
    const have = new Set(canon.map((c) => c.toLowerCase()));
    const missing = policy.policyRequiredCapabilities.filter((m) => !have.has(m.toLowerCase()));
    if (missing.length > 0) {
      return { ok: false, decision: reject("POLICY", "HSP-MAND-REQ-INSUFFICIENT", missing.join(",")) };
    }
  }

  const signerEntry = policy.signerProfiles.get(body.signer.profileId);
  if (!signerEntry) return { ok: false, decision: reject("POLICY", "HSP-MAND-SIGNER-PROFILE-UNKNOWN") };
  const mandateHash = computeMandateHash(domain, body);
  const signerDecision = await signerEntry.profile.verify(body.signer.payload, mandate.signerProof, mandateHash, body);
  if (!signerDecision.granted) {
    return { ok: false, decision: reject("PERMANENT", signerDecision.errorCode ?? "HSP-MAND-SIGNER") };
  }
  if (signerEntry.profile.description.stateDependent) {
    if (!signerEntry.profile.isStateStale || signerDecision.signerStateHash === undefined) {
      return {
        ok: false,
        decision: reject(
          "PERMANENT",
          "HSP-MAND-SIGNER-STATE-DRIFT",
          "state-dependent profile missing staleness machinery"
        ),
      };
    }
    if (signerEntry.profile.isStateStale(signerDecision.signerStateHash, signerEntry.stateAnchor ?? {}, now)) {
      return { ok: false, decision: reject("RETRYABLE", "HSP-MAND-SIGNER-STATE-DRIFT") };
    }
  }
  if (!signerDecision.resolvedSubject) {
    return { ok: false, decision: reject("PERMANENT", "HSP-MAND-SIGNER", "granted without resolvedSubject (SP6)") };
  }

  const roleAssignment = roleFunction(mandate, signerDecision, policy);
  return {
    ok: true,
    result: { domain, mandateHash, signerDecision, roleAssignment },
  };
}

function stripProof(receipt: Receipt): ReceiptHeader {
  const { adapterProof: _drop, ...header } = receipt;
  return header;
}

function admissible(admission: SchemaAdmission, isFollowUp: boolean, outcome: OutcomeValue): boolean {
  if (!isFollowUp) return admission === "accept-new";
  if (admission === "accept-new" || admission === "accept-historical") return true;
  return outcome === Outcome.DISPUTED || outcome === Outcome.FAILED;
}

function checkSettlementConsistency(
  body: MandateBody,
  requiredCapabilities: Hex[],
  outcome: VerifyOutcome
): AcceptDecision | null {
  if (outcome.tokenObserved && getAddress(outcome.tokenObserved.address) !== getAddress(body.token)) {
    return reject("PERMANENT", "HSP-RCPT-PROOF", "token mismatch");
  }
  if (outcome.chainIdObserved !== undefined && outcome.chainIdObserved !== Number(body.chainId)) {
    return reject("PERMANENT", "HSP-RCPT-PROOF", "chain mismatch");
  }
  if (body.recipient.kind === RecipientKind.ADDRESS) {
    const want = getAddress(decodeAbiParameters([{ type: "address" }], body.recipient.payload)[0]);
    if (outcome.recipientObservation.kind !== "address" || getAddress(outcome.recipientObservation.address) !== want) {
      return reject("PERMANENT", "HSP-RCPT-PROOF", "recipient mismatch");
    }
  } else {
    let commitment: string;
    try {
      commitment = (
        decodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], body.recipient.payload)[0] as string
      ).toLowerCase();
    } catch {
      return reject("PERMANENT", "HSP-MAND-RECIPIENT-DECODE", "malformed COMMITMENT recipient payload");
    }
    const observed = outcome.recipientObservation;
    if (observed.kind === "stealth") {
      if (observed.derivedFrom.toLowerCase() !== commitment) {
        return reject("PERMANENT", "HSP-RCPT-PROOF", "stealth derivation not bound to mandate commitment");
      }
    } else if (observed.kind === "shielded") {
      if (observed.boundTo === undefined || observed.boundTo.toLowerCase() !== commitment) {
        return reject("PERMANENT", "HSP-RCPT-PROOF", "shielded observation not bound to mandate commitment");
      }
    } else {
      return reject("PERMANENT", "HSP-RCPT-PROOF", "commitment recipient requires a bound stealth/shielded observation");
    }
  }
  const hidesAmountId = makeCap("hides:amount:v1").id.toLowerCase();
  const wantsHidden = canonicalizeCapSet(requiredCapabilities).some((c) => c.toLowerCase() === hidesAmountId);
  if (!wantsHidden) {
    if (outcome.amountObservation.kind !== "exact" || outcome.amountObservation.value !== BigInt(body.amount)) {
      return reject("PERMANENT", "HSP-MAND-AMOUNT-OUTOFBOUNDS", "amount not exact");
    }
  } else {
    if (outcome.amountObservation.kind === "exact") {
      return reject("PERMANENT", "HSP-MAND-AMOUNT-OUTOFBOUNDS", "hides:amount required but exact amount observed");
    }
    if (outcome.amountObservation.kind === "upper-bound" && outcome.amountObservation.value > BigInt(body.amount)) {
      return reject("PERMANENT", "HSP-MAND-AMOUNT-OUTOFBOUNDS", "upper-bound exceeds signed amount");
    }
  }
  return null;
}

function checkSequencing(receipt: Receipt, trustEntry: AdapterTrustEntry, prior: PriorState): AcceptDecision | null {
  const reorg = trustEntry.reorgPolicy;
  const seq = Number(receipt.seq);
  const outcome = Number(receipt.outcome) as OutcomeValue;

  if (prior.seen && seq <= prior.maxSeq) return reject("PERMANENT", "HSP-RCPT-SEQ-STALE");
  if (prior.disputed && outcome !== Outcome.DISPUTED) {
    return reject("PERMANENT", "HSP-RCPT-OUTCOME-INCONSISTENT", "post-DISPUTED non-DISPUTED emission");
  }
  if (prior.settledSeq !== undefined && outcome !== Outcome.DISPUTED) {
    return reject("PERMANENT", "HSP-RCPT-OUTCOME-INCONSISTENT", "post-SETTLED non-DISPUTED emission");
  }

  if (outcome === Outcome.DISPUTED) {
    if (prior.settledSeq === undefined) {
      return reject(seq > 0 ? "RETRYABLE" : "PERMANENT", "HSP-RCPT-DISPUTE-NOPRIOR");
    }
    if (!(prior.settledSeq < seq)) {
      return reject("PERMANENT", "HSP-RCPT-DISPUTE-NOPRIOR", "DISPUTED seq not greater than prior SETTLED");
    }
    if (reorg.disputeWindowMs === undefined) {
      return reject("POLICY", "HSP-LCYC-DISPUTE-WINDOW-CLOSED", "adapter makes no reversal promise");
    }
    const delta = Number(receipt.settledAt) - (prior.settledAt ?? 0);
    if (!(delta >= 0 && delta * 1000 <= reorg.disputeWindowMs)) {
      return reject("PERMANENT", "HSP-LCYC-DISPUTE-WINDOW-CLOSED", "reversal outside disputeWindowMs");
    }
  } else if (outcome === Outcome.ATTEMPTED && !reorg.allowsAttempted) {
    return reject("POLICY", "HSP-RCPT-OUTCOME-INCONSISTENT", "ATTEMPTED not allowed by reorgPolicy");
  }
  return null;
}

async function walkCap(
  reg: ParsedCapability,
  expectedSubject: PartyRef | undefined,
  attestations: Attestation[],
  policy: VerificationPolicy,
  now: number,
  mandateHash: Hex,
  receiptHash: Hex
): Promise<{ satisfied: boolean; code?: string; outcomeClass?: OutcomeClass }> {
  const famId = familyCapId(`${reg.namespace}:${reg.name}:${reg.version}`);
  const anchors = policy.issuerTrustAnchors.get(famId) ?? [];
  const scope = policy.contextBindingScope.get(famId);

  let severity = 0;
  for (const entry of attestations) {
    const schema = ATTESTATION_SCHEMAS[entry.schemaId];
    if (!schema) continue;
    let candParams;
    try {
      candParams = schema.decodeClaims(entry.claims);
    } catch {
      continue;
    }
    let candidate: ParsedCapability;
    try {
      candidate = makeCap(schema.baseCapKey, Object.fromEntries(candParams.map((p) => [p.key, p.value])));
    } catch {
      continue;
    }
    if (candidate.baseId.toLowerCase() !== entry.capabilityId.toLowerCase()) continue;
    if (!capSatisfies(reg, candidate)) continue;
    const cr2 = await validateCR2(entry, expectedSubject, anchors, now, mandateHash, receiptHash, scope);
    if (cr2.ok) return { satisfied: true };
    severity = Math.max(severity, cr2.code === "HSP-ATT-ISSUER-UNTRUSTED" ? 2 : 1);
  }
  const code = severity === 2 ? "HSP-ATT-ISSUER-UNTRUSTED" : severity === 1 ? "HSP-ATT-INVALID" : "HSP-ATT-MISSING";
  const outcomeClass: OutcomeClass = anchors.length > 0 ? "RETRYABLE" : "POLICY";
  return { satisfied: false, code, outcomeClass };
}

export async function verifyPhaseB(
  mandate: SignedMandate,
  a: PhaseAResult,
  receipt: Receipt,
  attestations: Attestation[],
  policy: VerificationPolicy,
  seqIndex: SeqIndex,
  obsIndex: ObservationIndex = new ObservationIndex()
): Promise<AcceptDecision> {
  const body = mandate.body;
  const now = policy.evaluationTime;

  if (receipt.mandateHash !== a.mandateHash) return reject("PERMANENT", "HSP-RCPT-LINK");

  const trustEntry = policy.adapterTrust.get(adapterKey(receipt.adapterId, receipt.adapterInstanceKey));
  if (!trustEntry) return reject("POLICY", "HSP-RCPT-SIG", "adapter instance not in trust set");
  const rHash = computeReceiptHash(a.domain, receipt);
  let recoveredAdapter: Address;
  try {
    recoveredAdapter = await recoverAddress({ hash: rHash, signature: receipt.adapterSignature });
  } catch {
    return reject("PERMANENT", "HSP-RCPT-SIG", "adapterSignature recover failed");
  }
  if (getAddress(recoveredAdapter) !== getAddress(trustEntry.address)) return reject("PERMANENT", "HSP-RCPT-SIG");

  if (
    seqIndex.isEquivocation(receipt.adapterId, receipt.adapterInstanceKey, receipt.mandateHash, Number(receipt.seq), rHash)
  ) {
    return reject("PERMANENT", "HSP-RCPT-EQUIVOCATION");
  }

  const schemaReg = policy.proofSchemas.get(schemaKey(receipt.adapterId, receipt.proofSchemaId));
  if (!schemaReg) return reject("POLICY", "HSP-RCPT-SCHEMA-UNKNOWN");
  const prior = seqIndex.state(receipt.adapterId, receipt.adapterInstanceKey, receipt.mandateHash);
  if (!admissible(schemaReg.admission, prior.seen, Number(receipt.outcome) as OutcomeValue)) {
    const cls: OutcomeClass = !prior.seen ? "POLICY" : "RETRYABLE";
    return reject(cls, "HSP-RCPT-SCHEMA-DEPRECATED");
  }

  const ctx: VerifyContext = {
    proofBytes: receipt.adapterProof,
    body,
    mandateHash: a.mandateHash,
    signerSubject: a.signerDecision.resolvedSubject!,
    receipt: stripProof(receipt),
    now,
    trustRoots: schemaReg.trustRoots,
  };
  const outcome = await schemaReg.schema.verify(ctx);
  if (!outcome.ok) return reject("PERMANENT", outcome.errorCode ?? "HSP-RCPT-PROOF");
  const upperBound = new Set(schemaReg.allowedCapabilities.map((c) => c.toLowerCase()));
  for (const c of outcome.proofSatisfiedCapabilities) {
    if (!upperBound.has(c.toLowerCase())) return reject("PERMANENT", "HSP-PROOF-CAP-NOT-DERIVED", c);
  }
  const consistency = checkSettlementConsistency(body, mandate.requiredCapabilities, outcome);
  if (consistency) return consistency;

  const covered = new Set<string>(outcome.proofSatisfiedCapabilities.map((c) => c.toLowerCase()));
  const reqCanon = canonicalizeCapSet(mandate.requiredCapabilities);
  for (const C of reqCanon) {
    if (covered.has(C.toLowerCase())) continue;
    const reg = policy.capabilityRegistry.get(C);
    if (!reg) return reject("POLICY", "HSP-CAP-UNKNOWN", C);
    let expectedSubject: PartyRef | undefined;
    if (reg.role) {
      expectedSubject = a.roleAssignment[reg.role];
      if (!expectedSubject) {
        return reject("POLICY", "HSP-SUBJ-ROLE-UNRESOLVED", reg.role);
      }
    }
    if (reg.namespace === "attests") {
      const res = await walkCap(reg, expectedSubject, attestations, policy, now, a.mandateHash, rHash);
      if (res.satisfied) covered.add(C.toLowerCase());
      else return reject(res.outcomeClass ?? "PERMANENT", res.code ?? "HSP-ATT-MISSING", C);
    }
  }

  const missing = reqCanon.filter((c) => !covered.has(c.toLowerCase()));
  if (missing.length > 0) return reject("PERMANENT", "HSP-RCPT-REQ-UNMET", missing.join(","));

  const oc = Number(receipt.outcome) as OutcomeValue;
  if ((oc === Outcome.ATTEMPTED || oc === Outcome.SETTLED) && Number(receipt.settledAt) > Number(body.deadline)) {
    return reject("PERMANENT", "HSP-MAND-EXPIRED", "settledAt > body.deadline (settled after mandate expiry)");
  }
  const seqCheck = checkSequencing(receipt, trustEntry, prior);
  if (seqCheck) return seqCheck;
  if (outcome.observationId) {
    const owner = obsIndex.owner(receipt.adapterId, outcome.observationId);
    if (owner && owner.toLowerCase() !== receipt.mandateHash.toLowerCase()) {
      return reject("PERMANENT", "HSP-RCPT-OBS-REUSED", `observation already consumed by ${owner}`);
    }
  }

  seqIndex.record(receipt.adapterId, receipt.adapterInstanceKey, receipt.mandateHash, {
    seq: Number(receipt.seq),
    outcome: oc,
    settledAt: Number(receipt.settledAt),
    receiptHash: rHash,
  });
  if (outcome.observationId) {
    obsIndex.record(receipt.adapterId, outcome.observationId, receipt.mandateHash);
  }
  return { ok: true, outcomeClass: outcomeClassForOk(oc) };
}

export async function verify(
  mandate: SignedMandate,
  receipt: Receipt,
  attestations: Attestation[],
  policy: VerificationPolicy,
  seqIndex: SeqIndex = new SeqIndex(),
  obsIndex: ObservationIndex = new ObservationIndex()
): Promise<AcceptDecision> {
  const a = await verifyPhaseA(mandate, policy);
  if (!a.ok) return a.decision;
  return verifyPhaseB(mandate, a.result, receipt, attestations, policy, seqIndex, obsIndex);
}

export { SeqIndex, ObservationIndex } from "./seq-index";
