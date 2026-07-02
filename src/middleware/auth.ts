import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/result";

export function requireOperatorAuth(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.NEXASH_OPERATOR_API_KEY;

  if (!expected) {
    throw new AppError("Server misconfiguration: no operator key configured", 500);
  }

  const provided = req.header("X-Nexash-Operator-Key");
  if (!provided || provided !== expected) {
    throw new AppError("Unauthorized", 401);
  }

  next();
}
