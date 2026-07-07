import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "../../src/utils/logger";

describe("logger redaction - secrets must never reach stdout/stderr", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    consoleSpy?.mockRestore();
  });

  it("redacts a top-level privateKey field", () => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("test", { privateKey: "0xSECRETVALUE" });
    const logged = consoleSpy.mock.calls[0]?.[0] as string;
    expect(logged).not.toContain("0xSECRETVALUE");
    expect(logged).toContain("[REDACTED]");
  });

  it("redacts a nested signature field, however deep", () => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("test", { outer: { inner: { signature: "0xSECRETSIG" } } });
    const logged = consoleSpy.mock.calls[0]?.[0] as string;
    expect(logged).not.toContain("0xSECRETSIG");
  });

  it("redacts apiKey and authorization regardless of casing", () => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("test", { ApiKey: "secret1", Authorization: "Bearer secret2" });
    const logged = consoleSpy.mock.calls[0]?.[0] as string;
    expect(logged).not.toContain("secret1");
    expect(logged).not.toContain("secret2");
  });

  it("redacts secrets inside an array of objects", () => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("test", { items: [{ privateKey: "0xARR_SECRET" }] });
    const logged = consoleSpy.mock.calls[0]?.[0] as string;
    expect(logged).not.toContain("0xARR_SECRET");
  });

  it("does not redact ordinary, non-sensitive fields", () => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("test", { payeeIdentifier: "alice", amount: "500" });
    const logged = consoleSpy.mock.calls[0]?.[0] as string;
    expect(logged).toContain("alice");
    expect(logged).toContain("500");
  });
});
