import { MARKET_REASONING_SYSTEM_PROMPT, MARKET_REASONING_RESPONSE_SCHEMA } from "./promptTemplates";
import { callLlm } from "../../llm/veniceClient";
import { buildRichSnapshot, formatSnapshotForPrompt, type RichMarketSnapshot } from "../../market/marketSnapshot";

export type { RichMarketSnapshot };

export interface ProposedPaperTrade {
  side: "buy" | "sell";
  pair: string;
  sizeFraction: number;
}

export interface MarketReasoningResult {
  reasoning: string;
  confidence: "low" | "medium" | "high";
  proposedAction: ProposedPaperTrade | null;
  readonly simulatedOnly: true;
}

export async function reasonAboutMarket(params: {
  userQuestion: string;
  pair: string;
}): Promise<MarketReasoningResult> {
  const snapshot = await buildRichSnapshot(params.pair);
  const formattedData = formatSnapshotForPrompt(snapshot);

  const userMessage =
    `Market data with multi-timeframe technical indicators:\n\n${formattedData}\n\n` +
    `User question: "${params.userQuestion}"`;

  const raw = (await callLlm({
    systemPrompt: MARKET_REASONING_SYSTEM_PROMPT,
    userMessage,
    responseSchema: MARKET_REASONING_RESPONSE_SCHEMA,
  })) as {
    reasoning: string;
    confidence: "low" | "medium" | "high";
    proposedAction: ProposedPaperTrade | null;
  };

  return {
    reasoning: raw.reasoning,
    confidence: raw.confidence,
    proposedAction: raw.proposedAction ?? null,
    simulatedOnly: true,
  };
}
