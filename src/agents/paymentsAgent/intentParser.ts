import {
  INTENT_PARSER_SYSTEM_PROMPT,
  INTENT_PARSER_RESPONSE_SCHEMA,
} from "./promptTemplates";
import { callLlm } from "../../llm/veniceClient";

/**
 * Wired to Venice AI (GLM-5.2) - see llm/veniceClient.ts. Agent isolation
 * guarantee unaffected: veniceClient has no import path to hsp/ or chain/,
 * same as before this was wired in.
 */

export interface PayeeDirectoryEntry {
  identifier: string;
  address: `0x${string}`;
}

export interface ProposedPayment {
  payeeIdentifier: string;
  resolvedPayeeAddress: `0x${string}` | null;
  amount: string;
  token: string;
  hold: boolean;
  holdReason: string | null;
}

export interface IntentParseResult {
  proposedPayments: ProposedPayment[];
  unresolvedReferences: string[];
}

/**
 * Placeholder for the actual LLM call. Intentionally isolated in its own
 * function so swapping in a real provider client touches exactly one
 * function, not every call site in this file.
 */
/**
 * Parses a natural-language payroll instruction into structured payment
 * proposals. This function NEVER touches hsp/mandateBuilder, chain/, or
 * any settlement path - it returns data only. The caller (a route handler)
 * decides what, if anything, happens with the proposals - this function has
 * no way to cause a payment to execute even if it wanted to.
 */
export async function parsePaymentIntent(params: {
  instruction: string;
  payeeDirectory: PayeeDirectoryEntry[];
}): Promise<IntentParseResult> {
  const directoryContext = params.payeeDirectory
    .map((entry) => `- ${entry.identifier}: ${entry.address}`)
    .join("\n");

  const userMessage = `Known payee directory:\n${directoryContext}\n\nOperator instruction:\n"${params.instruction}"`;

  const raw = await callLlm({
    systemPrompt: INTENT_PARSER_SYSTEM_PROMPT,
    userMessage,
    responseSchema: INTENT_PARSER_RESPONSE_SCHEMA,
  });

  return raw as IntentParseResult;
}
