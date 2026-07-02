import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/result";
import { logger } from "../utils/logger";

/**
 * Express's standard 4-argument error middleware signature. Must be
 * registered LAST in app.ts, after all routes, for Express to recognize it
 * as the error handler.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn("Handled application error", {
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
      message: err.publicMessage,
    });

    res.status(err.statusCode).json({
      error: err.publicMessage,
      type: err.name,
    });
    return;
  }

  // Anything that is NOT an AppError is treated as unexpected - log full
  // detail server-side, but never leak internals (stack traces, raw error
  // messages that might contain sensitive context) to the client.
  logger.error("Unhandled error", {
    path: req.path,
    method: req.method,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: "An unexpected error occurred",
    type: "InternalError",
  });
}
