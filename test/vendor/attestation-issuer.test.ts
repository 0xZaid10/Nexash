import { describe, it, expect } from "vitest";
import { recoverAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  issueKyc,
  issueSanctions,
  attestationStructHash,
  evmIssuerKeyId,
  evmIssuerPartyRef,
} from "../../src/hsp/vendor/attestation/issuer";
import { evmAddressPartyRef } from "../../src/hsp/vendor/profiles/signer/eip712-eoa";

describe("issueKyc / issueSanctions sign-verify round trip", () => {
  it("a signature recovers to the issuer's own address", async () => {
    const issuerKey = generatePrivateKey();
    const issuer = privateKeyToAccount(issuerKey);
    const subject = evmAddressPartyRef("0x1111111111111111111111111111111111111111");

    const attestation = await issueKyc({
      issuerPrivateKey: issuerKey,
      subject,
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: 0,
      level: "full",
    });

    const recovered = await recoverAddress({
      hash: attestationStructHash(attestation),
      signature: attestation.issuerSignature,
    });

    expect(recovered.toLowerCase()).toBe(issuer.address.toLowerCase());
  });

  it("issuerKeyId matches evmIssuerKeyId(issuer address)", async () => {
    const issuerKey = generatePrivateKey();
    const issuer = privateKeyToAccount(issuerKey);
    const subject = evmAddressPartyRef("0x2222222222222222222222222222222222222222");

    const attestation = await issueSanctions({
      issuerPrivateKey: issuerKey,
      subject,
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: 0,
    });

    expect(attestation.issuerKeyId.toLowerCase()).toBe(evmIssuerKeyId(issuer.address).toLowerCase());
  });

  it("tampering with claims after signing breaks signature recovery", async () => {
    const issuerKey = generatePrivateKey();
    const issuer = privateKeyToAccount(issuerKey);
    const subject = evmAddressPartyRef("0x3333333333333333333333333333333333333333");

    const attestation = await issueKyc({
      issuerPrivateKey: issuerKey,
      subject,
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: 0,
      level: "basic",
    });

    const tampered = { ...attestation, expiresAt: 9999999999 };
    const recovered = await recoverAddress({
      hash: attestationStructHash(tampered),
      signature: tampered.issuerSignature,
    });

    // The signature was over the ORIGINAL fields - recomputing the digest
    // over tampered fields must NOT recover the same signer.
    expect(recovered.toLowerCase()).not.toBe(issuer.address.toLowerCase());
  });

  it("two different issuers produce different issuerKeyIds for the same subject/claims", async () => {
    const keyA = generatePrivateKey();
    const keyB = generatePrivateKey();
    const subject = evmAddressPartyRef("0x4444444444444444444444444444444444444444");

    const a = await issueKyc({
      issuerPrivateKey: keyA,
      subject,
      issuedAt: 1000,
      expiresAt: 0,
      level: "full",
    });
    const b = await issueKyc({
      issuerPrivateKey: keyB,
      subject,
      issuedAt: 1000,
      expiresAt: 0,
      level: "full",
    });

    expect(a.issuerKeyId.toLowerCase()).not.toBe(b.issuerKeyId.toLowerCase());
  });

  it("evmIssuerPartyRef and evmAddressPartyRef produce the same encoding for the same address", () => {
    const addr = "0x6666666666666666666666666666666666666666" as `0x${string}`;
    expect(evmIssuerPartyRef(addr)).toEqual(evmAddressPartyRef(addr));
  });
});
