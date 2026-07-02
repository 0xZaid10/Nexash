// Vendored from project-hsp/hsp packages/core/src/verifier/seq-index.ts (Apache-2.0).

import { Outcome, type OutcomeValue } from "../core/index";
import type { Hex } from "viem";

export interface Emission {
  seq: number;
  outcome: OutcomeValue;
  settledAt: number;
  receiptHash: Hex;
}

export interface PriorState {
  seen: boolean;
  maxSeq: number;
  disputed: boolean;
  settledSeq?: number;
  settledAt?: number;
}

export class SeqIndex {
  private readonly m = new Map<string, Emission[]>();

  private key(adapterId: Hex, instanceKey: Hex, mandateHash: Hex): string {
    return `${adapterId.toLowerCase()}:${instanceKey.toLowerCase()}:${mandateHash.toLowerCase()}`;
  }

  state(adapterId: Hex, instanceKey: Hex, mandateHash: Hex): PriorState {
    const es = this.m.get(this.key(adapterId, instanceKey, mandateHash)) ?? [];
    if (es.length === 0) return { seen: false, maxSeq: -1, disputed: false };
    let maxSeq = -1;
    let disputed = false;
    let settledSeq: number | undefined;
    let settledAt: number | undefined;
    for (const e of es) {
      if (e.seq > maxSeq) maxSeq = e.seq;
      if (e.outcome === Outcome.DISPUTED) disputed = true;
      if (e.outcome === Outcome.SETTLED && (settledSeq === undefined || e.seq > settledSeq)) {
        settledSeq = e.seq;
        settledAt = e.settledAt;
      }
    }
    return { seen: true, maxSeq, disputed, settledSeq, settledAt };
  }

  isEquivocation(adapterId: Hex, instanceKey: Hex, mandateHash: Hex, seq: number, receiptHash: Hex): boolean {
    const es = this.m.get(this.key(adapterId, instanceKey, mandateHash)) ?? [];
    return es.some((e) => e.seq === seq && e.receiptHash.toLowerCase() !== receiptHash.toLowerCase());
  }

  record(adapterId: Hex, instanceKey: Hex, mandateHash: Hex, e: Emission): void {
    const k = this.key(adapterId, instanceKey, mandateHash);
    const arr = this.m.get(k) ?? [];
    arr.push(e);
    this.m.set(k, arr);
  }
}

export class ObservationIndex {
  private readonly m = new Map<string, Hex>();

  private key(adapterId: Hex, observationId: Hex): string {
    return `${adapterId.toLowerCase()}:${observationId.toLowerCase()}`;
  }

  owner(adapterId: Hex, observationId: Hex): Hex | undefined {
    return this.m.get(this.key(adapterId, observationId));
  }

  record(adapterId: Hex, observationId: Hex, mandateHash: Hex): void {
    this.m.set(this.key(adapterId, observationId), mandateHash.toLowerCase() as Hex);
  }
}
