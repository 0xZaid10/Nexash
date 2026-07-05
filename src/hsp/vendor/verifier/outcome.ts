// Vendored from project-hsp/hsp packages/core/src/verifier/outcome.ts (Apache-2.0).

import { Outcome, type OutcomeValue } from "../core/index";
import type { OutcomeClass } from "./contracts";

export function outcomeClassForOk(receiptOutcome: OutcomeValue): OutcomeClass {
  switch (receiptOutcome) {
    case Outcome.SETTLED:
      return "ACCEPT";
    case Outcome.ATTEMPTED:
      return "RETRYABLE";
    case Outcome.FAILED:
    case Outcome.DISPUTED:
      return "PERMANENT";
    default:
      return "PERMANENT";
  }
}

const MOST_RECOVERABLE: OutcomeClass[] = ["RETRYABLE", "POLICY", "PERMANENT"];
const LEAST_RECOVERABLE: OutcomeClass[] = ["PERMANENT", "POLICY", "RETRYABLE"];

function pickByOrder(classes: OutcomeClass[], order: OutcomeClass[], fallback: OutcomeClass): OutcomeClass {
  let best = fallback;
  let bestRank = order.indexOf(best);
  for (const c of classes) {
    const r = order.indexOf(c);
    if (r >= 0 && r < bestRank) {
      best = c;
      bestRank = r;
    }
  }
  return best;
}

export function mostRecoverable(classes: OutcomeClass[]): OutcomeClass {
  return pickByOrder(classes, MOST_RECOVERABLE, "PERMANENT");
}

export function leastRecoverable(classes: OutcomeClass[]): OutcomeClass {
  return pickByOrder(classes, LEAST_RECOVERABLE, "RETRYABLE");
}
