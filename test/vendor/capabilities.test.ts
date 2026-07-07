import { describe, it, expect } from "vitest";
import { makeCap, dominates, capSatisfies, Roles, familyCapId, roleWrap } from "../../src/hsp/vendor/core/capabilities";

describe("makeCap", () => {
  it("builds attests:kyc:v1 with a level param", () => {
    const cap = makeCap("attests:kyc:v1", { level: "full" });
    expect(cap.namespace).toBe("attests");
    expect(cap.name).toBe("kyc");
    expect(cap.params).toEqual([{ key: "level", type: "string", value: "full" }]);
  });

  it("throws on an unknown family", () => {
    expect(() => makeCap("not:a:realcap")).toThrow(/HSP-CAP-UNKNOWN/);
  });

  it("throws when a required param is missing", () => {
    expect(() => makeCap("attests:kyc:v1", {})).toThrow(/missing param/);
  });

  it("throws on an enum value outside the declared set", () => {
    expect(() => makeCap("attests:kyc:v1", { level: "ultra" })).toThrow(/not in enum/);
  });

  it("role-wraps when a role is provided, producing a different id than the base", () => {
    const base = makeCap("attests:kyc:v1", { level: "full" });
    const wrapped = makeCap("attests:kyc:v1", { level: "full" }, Roles.payer);
    expect(wrapped.id).not.toBe(base.id);
    expect(wrapped.baseId).toBe(base.baseId);
    expect(wrapped.id).toBe(roleWrap(Roles.payer, base.baseId));
  });
});

describe("dominates (monotone narrowing)", () => {
  it("full dominates basic for attests:kyc:v1 (asc-enum)", () => {
    const required = makeCap("attests:kyc:v1", { level: "basic" });
    const candidate = makeCap("attests:kyc:v1", { level: "full" });
    expect(dominates(required, candidate)).toBe(true);
  });

  it("basic does NOT dominate full (cannot satisfy a stricter requirement)", () => {
    const required = makeCap("attests:kyc:v1", { level: "full" });
    const candidate = makeCap("attests:kyc:v1", { level: "basic" });
    expect(dominates(required, candidate)).toBe(false);
  });

  it("equal levels dominate each other", () => {
    const required = makeCap("attests:kyc:v1", { level: "full" });
    const candidate = makeCap("attests:kyc:v1", { level: "full" });
    expect(dominates(required, candidate)).toBe(true);
  });

  it("different families never dominate", () => {
    const required = makeCap("attests:kyc:v1", { level: "basic" });
    const candidate = makeCap("attests:sanctions:v1", {});
    expect(dominates(required, candidate)).toBe(false);
  });

  it("desc-numeric: a LOWER maxScore candidate dominates a higher required ceiling", () => {
    const required = makeCap("attests:risk-score:v1", { maxScore: "50" });
    const candidate = makeCap("attests:risk-score:v1", { maxScore: "10" });
    expect(dominates(required, candidate)).toBe(true);
  });

  it("desc-numeric: a HIGHER maxScore candidate does not dominate a lower required ceiling", () => {
    const required = makeCap("attests:risk-score:v1", { maxScore: "10" });
    const candidate = makeCap("attests:risk-score:v1", { maxScore: "50" });
    expect(dominates(required, candidate)).toBe(false);
  });
});

describe("capSatisfies", () => {
  it("strict match: identical base caps always satisfy", () => {
    const required = makeCap("attests:sanctions:v1", {});
    const candidate = makeCap("attests:sanctions:v1", {});
    expect(capSatisfies(required, candidate)).toBe(true);
  });

  it("falls back to monotone dominance when base ids differ but family has ordered params", () => {
    const required = makeCap("attests:kyc:v1", { level: "basic" });
    const candidate = makeCap("attests:kyc:v1", { level: "full" });
    expect(capSatisfies(required, candidate)).toBe(true);
  });

  it("families with no ordered params require strict equality only", () => {
    const required = makeCap("attests:sanctions:v1", {});
    const candidate = makeCap("attests:travel-rule:v1", {});
    expect(capSatisfies(required, candidate)).toBe(false);
  });
});

describe("familyCapId", () => {
  it("matches the baseId of a cap built with empty params from the same family", () => {
    const wildcard = familyCapId("attests:kyc:v1");
    const cap = makeCap("attests:sanctions:v1", {});
    expect(familyCapId("attests:sanctions:v1")).toBe(cap.baseId);
    expect(wildcard).not.toBe(cap.baseId);
  });
});
