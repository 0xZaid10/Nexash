import { describe, it, expect } from "vitest";
import { validatePayeePolicy, validatePaymentAgainstLimits } from "../../src/payees/policyValidator";
import { CAPABILITY } from "../../src/config/hsp";

const VALID_ADDRESS = "0x1111111111111111111111111111111111111111" as const;

function validInput(overrides: Partial<Parameters<typeof validatePayeePolicy>[0]> = {}) {
  return {
    identifier: "alice",
    address: VALID_ADDRESS,
    requiredCapability: CAPABILITY.KYC,
    minKycLevel: 2,
    perPaymentLimit: "1000",
    dailyLimit: "5000",
    ...overrides,
  };
}

describe("validatePayeePolicy", () => {
  it("accepts a well-formed policy", () => {
    const result = validatePayeePolicy(validInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an empty identifier", () => {
    const result = validatePayeePolicy(validInput({ identifier: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /identifier/.test(e))).toBe(true);
  });

  it("rejects a whitespace-only identifier", () => {
    const result = validatePayeePolicy(validInput({ identifier: "   " }));
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed address", () => {
    const result = validatePayeePolicy(validInput({ address: "0xnotanaddress" as `0x${string}` }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /valid EVM address/.test(e))).toBe(true);
  });

  it("rejects an address missing the 0x prefix", () => {
    const result = validatePayeePolicy(
      validInput({ address: "1111111111111111111111111111111111111111" as `0x${string}` })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects an unrecognized capability", () => {
    const result = validatePayeePolicy(validInput({ requiredCapability: "not:a:cap" as never }));
    expect(result.valid).toBe(false);
  });

  it("rejects a negative minKycLevel", () => {
    const result = validatePayeePolicy(validInput({ minKycLevel: -1 }));
    expect(result.valid).toBe(false);
  });

  it("rejects a minKycLevel above the max (4)", () => {
    const result = validatePayeePolicy(validInput({ minKycLevel: 5 }));
    expect(result.valid).toBe(false);
  });

  it("rejects a non-integer minKycLevel", () => {
    const result = validatePayeePolicy(validInput({ minKycLevel: 2.5 }));
    expect(result.valid).toBe(false);
  });

  it("rejects a zero or negative perPaymentLimit", () => {
    expect(validatePayeePolicy(validInput({ perPaymentLimit: "0" })).valid).toBe(false);
    expect(validatePayeePolicy(validInput({ perPaymentLimit: "-100" })).valid).toBe(false);
  });

  it("rejects a non-numeric perPaymentLimit", () => {
    const result = validatePayeePolicy(validInput({ perPaymentLimit: "abc" }));
    expect(result.valid).toBe(false);
  });

  it("rejects perPaymentLimit exceeding dailyLimit (logically impossible policy)", () => {
    const result = validatePayeePolicy(validInput({ perPaymentLimit: "6000", dailyLimit: "5000" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /cannot exceed dailyLimit/.test(e))).toBe(true);
  });

  it("accepts perPaymentLimit exactly equal to dailyLimit", () => {
    const result = validatePayeePolicy(validInput({ perPaymentLimit: "5000", dailyLimit: "5000" }));
    expect(result.valid).toBe(true);
  });

  it("collects multiple independent errors at once rather than stopping at the first", () => {
    const result = validatePayeePolicy(
      validInput({ identifier: "", address: "bad" as `0x${string}`, minKycLevel: -1 })
    );
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("validatePaymentAgainstLimits", () => {
  it("accepts an amount within the per-payment limit", () => {
    const result = validatePaymentAgainstLimits({ amount: "500", perPaymentLimit: "1000" });
    expect(result.valid).toBe(true);
  });

  it("accepts an amount exactly equal to the limit", () => {
    const result = validatePaymentAgainstLimits({ amount: "1000", perPaymentLimit: "1000" });
    expect(result.valid).toBe(true);
  });

  it("rejects an amount exceeding the per-payment limit", () => {
    const result = validatePaymentAgainstLimits({ amount: "1001", perPaymentLimit: "1000" });
    expect(result.valid).toBe(false);
  });

  it("rejects a zero amount", () => {
    const result = validatePaymentAgainstLimits({ amount: "0", perPaymentLimit: "1000" });
    expect(result.valid).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = validatePaymentAgainstLimits({ amount: "-50", perPaymentLimit: "1000" });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-numeric amount", () => {
    const result = validatePaymentAgainstLimits({ amount: "abc", perPaymentLimit: "1000" });
    expect(result.valid).toBe(false);
  });
});
