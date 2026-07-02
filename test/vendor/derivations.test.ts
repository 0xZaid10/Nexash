import { describe, it, expect } from "vitest";
import { encodeAbiParameters, keccak256, stringToBytes, type Hex } from "viem";
import {
  mandateHash,
  requiredCapabilitiesHash,
  capabilityId,
  canonicalParamsEncoding,
  type MandateBodyInput,
  type DomainInput,
} from "../../src/hsp/vendor/derivations";

const domain: DomainInput = {
  name: "HSP",
  version: "1",
  chainId: 177,
  verifyingContract: "0x0000000000000000000000000000000000000001",
};

function sampleBody(overrides: Partial<MandateBodyInput> = {}): MandateBodyInput {
  return {
    nonce: keccak256(stringToBytes("nonce-1")),
    signer: {
      profileId: keccak256(stringToBytes("eip712-eoa.v1")),
      payload: encodeAbiParameters([{ type: "address" }], ["0x1111111111111111111111111111111111111111"]),
    },
    recipient: {
      kind: 0,
      payload: encodeAbiParameters([{ type: "address" }], ["0x2222222222222222222222222222222222222222"]),
    },
    token: "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6",
    amount: "1000000",
    chainId: 177,
    deadline: 9999999999,
    requiredCapabilitiesHash: requiredCapabilitiesHash([]),
    ...overrides,
  };
}

describe("mandateHash", () => {
  it("is deterministic for identical input", () => {
    const body = sampleBody();
    expect(mandateHash(domain, body)).toBe(mandateHash(domain, body));
  });

  it("changes when nonce changes", () => {
    const a = mandateHash(domain, sampleBody());
    const b = mandateHash(domain, sampleBody({ nonce: keccak256(stringToBytes("nonce-2")) }));
    expect(a).not.toBe(b);
  });

  it("changes when amount changes", () => {
    const a = mandateHash(domain, sampleBody({ amount: "1000000" }));
    const b = mandateHash(domain, sampleBody({ amount: "2000000" }));
    expect(a).not.toBe(b);
  });

  it("changes when chainId in the domain changes", () => {
    const a = mandateHash(domain, sampleBody());
    const b = mandateHash({ ...domain, chainId: 133 }, sampleBody());
    expect(a).not.toBe(b);
  });

  it("changes when signer payload changes", () => {
    const a = mandateHash(domain, sampleBody());
    const b = mandateHash(
      domain,
      sampleBody({
        signer: {
          profileId: keccak256(stringToBytes("eip712-eoa.v1")),
          payload: encodeAbiParameters([{ type: "address" }], ["0x3333333333333333333333333333333333333333"]),
        },
      })
    );
    expect(a).not.toBe(b);
  });
});

describe("requiredCapabilitiesHash", () => {
  it("returns bytes32(0) for an empty array", () => {
    expect(requiredCapabilitiesHash([])).toBe(`0x${"00".repeat(32)}`);
  });

  it("is order-independent (canonicalized before hashing)", () => {
    const a = keccak256(stringToBytes("cap-a"));
    const b = keccak256(stringToBytes("cap-b"));
    expect(requiredCapabilitiesHash([a, b])).toBe(requiredCapabilitiesHash([b, a]));
  });

  it("dedupes identical capability ids", () => {
    const a = keccak256(stringToBytes("cap-a"));
    expect(requiredCapabilitiesHash([a, a])).toBe(requiredCapabilitiesHash([a]));
  });

  it("is case-insensitive on hex casing", () => {
    const a = keccak256(stringToBytes("cap-a"));
    const upper = (a.slice(0, 2) + a.slice(2).toUpperCase()) as Hex;
    expect(requiredCapabilitiesHash([a])).toBe(requiredCapabilitiesHash([upper]));
  });

  it("differs for different capability sets", () => {
    const a = keccak256(stringToBytes("cap-a"));
    const b = keccak256(stringToBytes("cap-b"));
    expect(requiredCapabilitiesHash([a])).not.toBe(requiredCapabilitiesHash([a, b]));
  });
});

describe("capabilityId", () => {
  it("is deterministic for identical input", () => {
    const input = { namespace: "attests", name: "kyc", version: "v1", params: [] };
    expect(capabilityId(input)).toBe(capabilityId(input));
  });

  it("differs by namespace", () => {
    const a = capabilityId({ namespace: "attests", name: "kyc", version: "v1", params: [] });
    const b = capabilityId({ namespace: "proves", name: "kyc", version: "v1", params: [] });
    expect(a).not.toBe(b);
  });

  it("differs by params (level basic vs full)", () => {
    const a = capabilityId({
      namespace: "attests",
      name: "kyc",
      version: "v1",
      params: [{ key: "level", type: "string", value: "basic" }],
    });
    const b = capabilityId({
      namespace: "attests",
      name: "kyc",
      version: "v1",
      params: [{ key: "level", type: "string", value: "full" }],
    });
    expect(a).not.toBe(b);
  });

  it("empty params produces the same id as the family wildcard form", () => {
    const a = capabilityId({ namespace: "attests", name: "sanctions", version: "v1", params: [] });
    const b = capabilityId({ namespace: "attests", name: "sanctions", version: "v1", params: [] });
    expect(a).toBe(b);
  });
});

describe("canonicalParamsEncoding", () => {
  it("sorts params by key before encoding (order-independent result)", () => {
    const a = canonicalParamsEncoding([
      { key: "b", type: "string", value: "2" },
      { key: "a", type: "string", value: "1" },
    ]);
    const b = canonicalParamsEncoding([
      { key: "a", type: "string", value: "1" },
      { key: "b", type: "string", value: "2" },
    ]);
    expect(a).toBe(b);
  });

  it("returns 0x for empty params", () => {
    expect(canonicalParamsEncoding([])).toBe("0x");
  });
});
