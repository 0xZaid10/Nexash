import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../utils/result";

/**
 * Wraps a Zod schema as Express middleware: parses req.body, attaches the
 * parsed (and now type-safe) result back onto req.body, or throws a
 * ValidationError (422) with the specific field errors if parsing fails.
 * Route handlers downstream can then trust req.body's shape without
 * re-checking it themselves.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new ValidationError(`Invalid request body - ${issues}`);
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new ValidationError(`Invalid query parameters - ${issues}`);
    }

    // Express's req.query is typed as a getter-only property in some
    // versions - cast through unknown rather than assign directly to avoid
    // a type error, while still making the parsed result available.
    (req as unknown as { query: unknown }).query = result.data;
    next();
  };
}
