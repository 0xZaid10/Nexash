export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Distinguishes errors the caller should expect and handle gracefully
 * (validation failures, not-found, policy violations) from genuinely
 * unexpected failures (a bug, a network outage). Routes use this to decide
 * status code: AppError -> 4xx with the message shown to the client,
 * anything else -> 500 with a generic message (see errorHandler.ts).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly publicMessage: string;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.publicMessage = message;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
    this.name = "ValidationError";
  }
}

export class ComplianceError extends AppError {
  constructor(message: string) {
    super(message, 403);
    this.name = "ComplianceError";
  }
}
