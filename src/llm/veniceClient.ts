import { env } from "../config/env";

/**
 * Venice AI (api.venice.ai) - OpenAI-compatible /chat/completions. Model
 * is GLM-5.2 by default (VENICE_MODEL), chosen for cost vs our actual
 * usage pattern (structured JSON extraction, not deep creative reasoning).
 *
 * UNCONFIRMED: whether Venice/GLM-5.2 supports strict response_format JSON
 * schema enforcement (vs just a system-prompt instruction to return JSON).
 * We ask for JSON via response_format below AND keep the system-prompt
 * instruction as a second layer - parseJsonResponse() below throws loudly
 * on malformed output rather than silently passing through bad data,
 * since we cannot yet confirm enforcement is real.
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface VeniceChatCompletionResponse {
  choices: { message: { content: string } }[];
}

export class LlmCallError extends Error {
  constructor(message: string, readonly rawResponse?: string) {
    super(message);
    this.name = "LlmCallError";
  }
}

async function callVenice(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${env.VENICE_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.VENICE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.VENICE_MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LlmCallError(`Venice API request failed: ${res.status} ${res.statusText}`, body);
  }

  const data = (await res.json()) as VeniceChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new LlmCallError("Venice API returned no message content", JSON.stringify(data));
  }

  return content;
}

function parseJsonResponse(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new LlmCallError(
      `LLM response was not valid JSON after cleanup: ${err instanceof Error ? err.message : String(err)}`,
      raw
    );
  }
}

export async function callLlm(params: {
  systemPrompt: string;
  userMessage: string;
  responseSchema: object;
}): Promise<unknown> {
  const schemaInstruction = `Respond with JSON matching this shape exactly:\n${JSON.stringify(
    params.responseSchema,
    null,
    2
  )}`;

  const messages: ChatMessage[] = [
    { role: "system", content: `${params.systemPrompt}\n\n${schemaInstruction}` },
    { role: "user", content: params.userMessage },
  ];

  const raw = await callVenice(messages);
  return parseJsonResponse(raw);
}
