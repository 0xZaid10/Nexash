import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../src/middleware/errorHandler";
import { AppError, ComplianceError, NotFoundError, ValidationError } from "../../src/utils/result";

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json } as unknown as Response & { status: typeof status; json: typeof json };
}

function mockReq(): Request {
  return { path: "/test", method: "POST" } as Request;
}

describe("errorHandler", () => {
  it("maps AppError to its own statusCode and exposes its public message", () => {
    const res = mockRes();
    const err = new AppError("custom failure", 418);
    errorHandler(err, mockReq(), res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith({ error: "custom failure", type: "AppError" });
  });

  it("maps ComplianceError to 403", () => {
    const res = mockRes();
    errorHandler(new ComplianceError("not compliant"), mockReq(), res, vi.fn() as NextFunction);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("maps NotFoundError to 404", () => {
    const res = mockRes();
    errorHandler(new NotFoundError("missing"), mockReq(), res, vi.fn() as NextFunction);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("maps ValidationError to 422", () => {
    const res = mockRes();
    errorHandler(new ValidationError("bad input"), mockReq(), res, vi.fn() as NextFunction);
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it("maps an arbitrary thrown Error to a generic 500 WITHOUT leaking its message", () => {
    const res = mockRes();
    const sensitiveError = new Error("DB connection string: postgres://user:supersecret@host/db");
    errorHandler(sensitiveError, mockReq(), res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonCall = res.json.mock.calls[0]?.[0];
    expect(JSON.stringify(jsonCall)).not.toContain("supersecret");
    expect(jsonCall).toEqual({ error: "An unexpected error occurred", type: "InternalError" });
  });

  it("maps a non-Error thrown value (string/object) to the same generic 500", () => {
    const res = mockRes();
    errorHandler("just a string throw", mockReq(), res, vi.fn() as NextFunction);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("never includes a stack trace in the client-facing JSON", () => {
    const res = mockRes();
    const err = new Error("boom");
    errorHandler(err, mockReq(), res, vi.fn() as NextFunction);
    const jsonCall = res.json.mock.calls[0]?.[0];
    expect(JSON.stringify(jsonCall)).not.toContain("at ");
  });
});
