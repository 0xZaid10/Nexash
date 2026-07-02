import { describe, it, expect } from "vitest";
import { encodeAbiParameters, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { eip712EoaSigner, signMandateHash } from "../../src/hsp/vendor/profiles/signer/eip712-eoa";
import {
  mandateHash,
  requiredCapabilitiesHash,
  type MandateBodyInput,
  type DomainInput,
} from "../../src/hsp/vendor/derivations";

const domain: DomainInput = {
  name: "HSP",
  version: "1",
  chainId: 177,
  verifyingContract: "0x0000000000000000000000000000000000000001",
};

function sampleBody(signerAddress: `0x${string}`): MandateBodyInput {
  return {
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
    signer: {
      profileId: eip712EoaSigner.profileIdHash,
      payload: encodeAbiParameters([{ type: "address" }], [signerAddress]),
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
  };
}

describe("eip712-eoa signer profile - adversarial inputs", () => {
  it("REJECTs a signature produced by a DIFFERENT key than the one declared in the payload", async () => {
    const declaredKey = generatePrivateKey();
    const declared = privateKeyToAccount(declaredKey);
    const actualSignerKey = generatePrivateKey();

    const body = sampleBody(declared.address);
    const mHash = mandateHash(domain, body);
    const forgedProof = await signMandateHash(actualSignerKey, mHash);

    const decision = await eip712EoaSigner.verify(body.signer.payload, forgedProof, mHash, body);

    expect(decision.granted).toBe(false);
    expect(decision.errorCode).toBe("HSP-MAND-SIGNER");
  });

  it("REJECTs a signature replayed against a DIFFERENT mandateHash", async () => {
    const signerKey = generatePrivateKey();
    const signer = privateKeyToAccount(signerKey);

    const body1 = sampleBody(signer.address);
    const mHash1 = mandateHash(domain, body1);
    const proof1 = await signMandateHash(signerKey, mHash1);

    const body2 = sampleBody(signer.address);
    const mHash2 = mandateHash(domain, body2);
    expect(mHash2).not.toBe(mHash1);

    const decision = await eip712EoaSigner.verify(body2.signer.payload, proof1, mHash2, body2);
    expect(decision.granted).toBe(false);
  });

  it("REJECTs a proof that is not exactly 65 bytes", async () => {
    const signerKey = generatePrivateKey();
    const signer = privateKeyToAccount(signerKey);
    const body = sampleBody(signer.address);
    const mHash = mandateHash(domain, body);

    const truncatedProof = "0x1234" as `0x${string}`;

    const decision = await eip712EoaSigner.verify(body.signer.payload, truncatedProof, mHash, body);
    expect(decision.granted).toBe(false);
    expect(decision.errorCode).toBe("HSP-MAND-SIGNER");
  });

  it("REJECTs a malformed signer payload (not a valid abi-encoded address)", async () => {
    const signerKey = generatePrivateKey();
    const body = sampleBody(privateKeyToAccount(signerKey).address);
    const mHash = mandateHash(domain, body);
    const proof = await signMandateHash(signerKey, mHash);

    const garbagePayload = "0xdeadbeef" as `0x${string}`;

    const decision = await eip712EoaSigner.verify(garbagePayload, proof, mHash, body);
    expect(decision.granted).toBe(false);
    expect(decision.errorCode).toBe("HSP-MAND-SIGNER");
  });

  it("a high-s (malleable) proof is rejected by the EIP-2 low-s enforcement", async () => {
    const signerKey = generatePrivateKey();
    const signer = privateKeyToAccount(signerKey);
    const body = sampleBody(signer.address);
    const mHash = mandateHash(domain, body);
    const proof = await signMandateHash(signerKey, mHash);

    const r = proof.slice(2, 66);
    const vHex = proof.slice(130, 132);
    // secp256k1n - 1: guaranteed above the n/2 low-s boundary regardless of
    // whether it forms a "real" malleated twin for this specific signature.
    const highS = "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364142";
    const corruptedProof = `0x${r}${highS}${vHex}` as `0x${string}`;

    const decision = await eip712EoaSigner.verify(body.signer.payload, corruptedProof, mHash, body);
    expect(decision.granted).toBe(false);
    expect(decision.errorCode).toBe("HSP-MAND-SIGNER");
  });

  it("REJECTs v values outside {27, 28}", async () => {
    const signerKey = generatePrivateKey();
    const signer = privateKeyToAccount(signerKey);
    const body = sampleBody(signer.address);
    const mHash = mandateHash(domain, body);
    const proof = await signMandateHash(signerKey, mHash);

    const corruptedProof = (proof.slice(0, 130) + "00") as `0x${string}`;

    const decision = await eip712EoaSigner.verify(body.signer.payload, corruptedProof, mHash, body);
    expect(decision.granted).toBe(false);
    expect(decision.errorCode).toBe("HSP-MAND-SIGNER");
  });

  it("a genuinely valid signature DOES verify (sanity check the rejections above are meaningful)", async () => {
    const signerKey = generatePrivateKey();
    const signer = privateKeyToAccount(signerKey);
    const body = sampleBody(signer.address);
    const mHash = mandateHash(domain, body);
    const proof = await signMandateHash(signerKey, mHash);

    const decision = await eip712EoaSigner.verify(body.signer.payload, proof, mHash, body);
    expect(decision.granted).toBe(true);
    expect(decision.resolvedSubject?.scheme).toBe("evm-address");
  });
});
