import { describe, it, expect, vi } from "vitest";
import { BaseError } from "viem";
import { withTxRetry } from "../../src/chain/txManager";

function makeBaseError(shortMessage: string): BaseError {
  return new BaseError(shortMessage);
}

describe("withTxRetry", () => {
  it("returns immediately on success, attempts = 1", async () => {
    const fn = vi.fn().mockResolvedValue("0xhash");
    const result = await withTxRetry(fn);
    expect(result.hash).toBe("0xhash");
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("retries on a transient 'nonce too low' error and eventually succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeBaseError("nonce too low"))
      .mockResolvedValueOnce("0xhash");

    const result = await withTxRetry(fn, { retryDelayMs: 1 });
    expect(result.hash).toBe("0xhash");
    expect(result.attempts).toBe(2);
  });

  it("does NOT retry a genuine contract revert (e.g. ComplianceRequirementNotMet)", async () => {
    const revertError = makeBaseError("ComplianceRequirementNotMet");
    const fn = vi.fn().mockRejectedValue(revertError);

    await expect(withTxRetry(fn, { retryDelayMs: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not retry a non-BaseError exception", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("totally unrelated"));
    await expect(withTxRetry(fn, { retryDelayMs: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledOnce();
  });

  it("gives up after maxRetries and throws the last error", async () => {
    const fn = vi.fn().mockRejectedValue(makeBaseError("connection timeout"));
    await expect(withTxRetry(fn, { maxRetries: 3, retryDelayMs: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("retries on 'replacement transaction underpriced'", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(makeBaseError("replacement transaction underpriced"))
      .mockResolvedValueOnce("0xhash2");

    const result = await withTxRetry(fn, { retryDelayMs: 1 });
    expect(result.attempts).toBe(2);
  });
});
