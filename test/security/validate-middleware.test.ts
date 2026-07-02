import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { validateBody } from "../../src/middleware/validate";
import { ValidationError } from "../../src/utils/result";

const schema = z.object({
  amount: z.string(),
  identifier: z.string().min(1),
});

function mockReqRes(body: unknown) {
  const req = { body } as Request;
  const res = {} as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("validateBody", () => {
  it("calls next() and replaces req.body with the parsed result on success", () => {
    const { req, res, next } = mockReqRes({ amount: "500", identifier: "alice" });
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ amount: "500", identifier: "alice" });
  });

  it("throws ValidationError when a required field is missing", () => {
    const { req, res, next } = mockReqRes({ amount: "500" });
    expect(() => validateBody(schema)(req, res, next)).toThrow(ValidationError);
  });

  it("throws ValidationError when a field has the wrong type", () => {
    const { req, res, next } = mockReqRes({ amount: 500, identifier: "alice" });
    expect(() => validateBody(schema)(req, res, next)).toThrow(ValidationError);
  });

  it("throws ValidationError when identifier is an empty string", () => {
    const { req, res, next } = mockReqRes({ amount: "500", identifier: "" });
    expect(() => validateBody(schema)(req, res, next)).toThrow(ValidationError);
  });

  it("rejects entirely unrelated payload shapes", () => {
    const { req, res, next } = mockReqRes({ unrelated: true });
    expect(() => validateBody(schema)(req, res, next)).toThrow(ValidationError);
  });

  it("the thrown error has statusCode 422", () => {
    const { req, res, next } = mockReqRes({});
    try {
      validateBody(schema)(req, res, next);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ValidationError).statusCode).toBe(422);
    }
  });
});
