import { env } from "../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const REDACTED_KEYS = new Set([
  "privatekey",
  "private_key",
  "signature",
  "apikey",
  "api_key",
  "authorization",
]);

/**
 * Deliberately conservative: redacts any field whose key looks like it
 * might hold key/secret material, rather than maintaining an exact
 * allowlist that could miss a new field added later. This matters most for
 * the issuer module - a logged signature or private key is a real leak,
 * not just noisy output.
 */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(val);
    }
    return out;
  }

  return value;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[env.LOG_LEVEL];
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context: redact(context) } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};
