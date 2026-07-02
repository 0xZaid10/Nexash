import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireOperatorAuth } from "../../src/middleware/auth";
import { AppError } from "../../src/utils/result";

function mockReqRes(headers: Record<string, string> = {}) {
  const req = { header: (name: string) => headers[name] } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("requireOperatorAuth", () => {
  const ORIGINAL_KEY = process.env.NEXASH_OPERATOR_API_KEY;

  beforeEach(() => {
    process.env.NEXASH_OPERATOR_API_KEY = "real-secret-key";
  });

  it("calls next() when the correct key is provided", () => {
    const { req, res, next } = mockReqRes({ "X-Nexash-Operator-Key": "real-secret-key" });
    requireOperatorAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("throws Unauthorized when no key header is provided at all", () => {
    const { req, res, next } = mockReqRes({});
    expect(() => requireOperatorAuth(req, res, next)).toThrow(AppError);
    try {
      requireOperatorAuth(req, res, next);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("throws Unauthorized for an incorrect key", () => {
    const { req, res, next } = mockReqRes({ "X-Nexash-Operator-Key": "wrong-key" });
    expect(() => requireOperatorAuth(req, res, next)).toThrow(AppError);
  });

  it("throws Unauthorized for an empty-string key (not treated as absent-and-skipped)", () => {
    const { req, res, next } = mockReqRes({ "X-Nexash-Operator-Key": "" });
    expect(() => requireOperatorAuth(req, res, next)).toThrow(AppError);
  });

  it("is not fooled by a key that is a PREFIX of the real key", () => {
    const { req, res, next } = mockReqRes({ "X-Nexash-Operator-Key": "real-secret" });
    expect(() => requireOperatorAuth(req, res, next)).toThrow(AppError);
  });

  it("is not fooled by a key that is the real key plus extra characters", () => {
    const { req, res, next } = mockReqRes({ "X-Nexash-Operator-Key": "real-secret-keyXXXX" });
    expect(() => requireOperatorAuth(req, res, next)).toThrow(AppError);
  });

  it("refuses ALL requests (500, not silently authorized) if the server itself has no configured key", () => {
    delete process.env.NEXASH_OPERATOR_API_KEY;
    const { req, res, next } = mockReqRes({ "X-Nexash-Operator-Key": "anything" });

    let caught: unknown;
    try {
      requireOperatorAuth(req, res, next);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();

    process.env.NEXASH_OPERATOR_API_KEY = ORIGINAL_KEY;
  });
});
