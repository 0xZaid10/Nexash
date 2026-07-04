import {
  ANOMALY_REVIEW_SYSTEM_PROMPT,
  ANOMALY_REVIEW_RESPONSE_SCHEMA,
} from "./promptTemplates";
import type { ProposedPayment } from "./intentParser";
import { callLlm } from "../../llm/veniceClient";

export interface PayeeHistoryEntry {
  payeeIdentifier: string;
  pastAmounts: string[];
  lastPaymentTimestamp: number | null;
}

export interface AnomalyFlag {
  payeeIdentifier: string;
  severity: "low" | "medium" | "high";
  reason: string;
}

export interface AnomalyReviewResult {
  flags: AnomalyFlag[];
  summary: string;
  /**
   * Deliberately explicit: this result is advisory. Nothing in this
   * module's return type or behavior can prevent a payment from
   * proceeding - that decision belongs entirely to the human operator
   * reading these flags, and ultimately to AttestationRegistry/
   * PayrollTreasury's on-chain checks, never to this review itself.
   */
  readonly advisoryOnly: true;
}

/**
 * Reviews a batch of proposed payments against payee history for anything
 * worth a human's attention. This function has no settlement authority and
 * no compliance authority - see promptTemplates.ts's
 * ANOMALY_REVIEW_SYSTEM_PROMPT for the explicit boundaries given to the
 * model itself, mirrored here in the boundaries given to the calling code.
 */
export async function reviewPaymentBatch(params: {
  proposedPayments: ProposedPayment[];
  payeeHistory: PayeeHistoryEntry[];
}): Promise<AnomalyReviewResult> {
  const historyContext = params.payeeHistory
    .map(
      (h) =>
        `- ${h.payeeIdentifier}: past amounts [${h.pastAmounts.join(", ")}], ` +
        `last paid at ${h.lastPaymentTimestamp ?? "never"}`
    )
    .join("\n");

  const batchContext = params.proposedPayments
    .map((p) => `- ${p.payeeIdentifier}: ${p.amount} ${p.token}${p.hold ? " (HOLD)" : ""}`)
    .join("\n");

  const userMessage = `Payee history:\n${historyContext}\n\nProposed batch:\n${batchContext}`;

  const raw = (await callLlm({
    systemPrompt: ANOMALY_REVIEW_SYSTEM_PROMPT,
    userMessage,
    responseSchema: ANOMALY_REVIEW_RESPONSE_SCHEMA,
  })) as { flags: AnomalyFlag[]; summary: string };

  return {
    flags: raw.flags,
    summary: raw.summary,
    advisoryOnly: true,
  };
}
