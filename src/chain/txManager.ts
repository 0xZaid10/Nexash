import { type Hash, BaseError } from "viem";

export interface TxAttemptResult {
  hash: Hash;
  attempts: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof BaseError)) return false;
  const message = err.shortMessage?.toLowerCase() ?? "";
  // Nonce races and transient RPC issues are worth retrying; reverts due to
  // contract logic (NotOperator, ComplianceRequirementNotMet, etc.) are NOT -
  // retrying a genuine revert just wastes gas and time for the same outcome.
  return (
    message.includes("nonce too low") ||
    message.includes("replacement transaction underpriced") ||
    message.includes("timeout") ||
    message.includes("connection")
  );
}

/**
 * Wraps a single on-chain write call (e.g. releasePaymentOnChain,
 * recordAttestationOnChain) with bounded retry on transient failures only.
 * Does NOT retry on contract-logic reverts - those are deterministic and
 * retrying them would just reproduce the same revert.
 */
export async function withTxRetry<T extends Hash>(
  txFn: () => Promise<T>,
  options?: { maxRetries?: number; retryDelayMs?: number }
): Promise<TxAttemptResult> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const hash = await txFn();
      return { hash, attempts: attempt };
    } catch (err) {
      lastError = err;

      if (!isRetryableError(err) || attempt === maxRetries) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }

  throw lastError;
}
