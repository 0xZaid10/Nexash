import { describe, it, expect } from "vitest";
import { encodeAbiParameters, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  mandateHash,
  requiredCapabilitiesHash,
  type MandateBodyInput,
  type DomainInput,
} from "../../src/hsp/vendor/derivations";
import { signMandateHash, eip712EoaSigner, evmAddressPartyRef } from "../../src/hsp/vendor/profiles/signer/eip712-eoa";
import { verify, SeqIndex, ObservationIndex } from "../../src/hsp/vendor/verifier/index";
import { buildPublicPolicy, type HspChainConfig } from "../../src/hsp/vendor/policy/public";
import { buildCompliancePolicy } from "../../src/hsp/vendor/policy/compliance";
import { makeCap, Roles } from "../../src/hsp/vendor/core/capabilities";
import { issueKyc } from "../../src/hsp/vendor/attestation/issuer";
import { buildAndSignReceipt } from "../../src/hsp/vendor/adapter/mock-evm-transfer";
import type { SignedMandate } from "../../src/hsp/vendor/core/types";

const VERIFYING_CONTRACT = "0x0000000000000000000000000000000000000001" as const;
const ADAPTER_INSTANCE_KEY = `0x${"00".repeat(32)}` as const;

const chain: HspChainConfig = {
  chainId: 31337,
  verifyingContract: VERIFYING_CONTRACT,
  adapterInstanceKey: ADAPTER_INSTANCE_KEY,
};

const domain: DomainInput = {
  name: "HSP",
  version: "1",
  chainId: chain.chainId,
  verifyingContract: VERIFYING_CONTRACT,
};

async function buildAndSignTestMandate(params: {
  payerKey: `0x${string}`;
  payee: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  requiredCapabilities?: `0x${string}`[];
}): Promise<SignedMandate> {
  const payer = privateKeyToAccount(params.payerKey);
  const caps = params.requiredCapabilities ?? [];

  const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  const body: MandateBodyInput = {
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
    signer: {
      profileId: eip712EoaSigner.profileIdHash,
      payload: encodeAbiParameters([{ type: "address" }], [payer.address]),
    },
    grantRef: ZERO32,
    requirementRef: ZERO32,
    recipient: { kind: 0, payload: encodeAbiParameters([{ type: "address" }], [params.payee]) },
    token: params.token,
    amount: params.amount.toString(),
    chainId: chain.chainId,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    settlementBinding: ZERO32,
    requiredCapabilitiesHash: requiredCapabilitiesHash(caps),
  };

  const mHash = mandateHash(domain, body);
  const signerProof = await signMandateHash(params.payerKey, mHash);

  return { body, signerProof, requiredCapabilities: caps };
}

describe("full verify() integration - public (non-compliance) path", () => {
  it("ACCEPTs a correctly signed mandate with a matching settled receipt", async () => {
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;

    const mandate = await buildAndSignTestMandate({ payerKey, payee, token, amount });
    const mHash = mandateHash(domain, mandate.body);

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildPublicPolicy(chain, adapter.address, Math.floor(Date.now() / 1000));
    const decision = await verify(mandate, receipt, [], policy);

    expect(decision.ok).toBe(true);
    expect(decision.outcomeClass).toBe("ACCEPT");
  });

  it("REJECTs when the settlement sender does not match the mandate signer", async () => {
    const payerKey = generatePrivateKey();
    const impostorKey = generatePrivateKey();
    const impostor = privateKeyToAccount(impostorKey);
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;

    const mandate = await buildAndSignTestMandate({ payerKey, payee, token, amount });
    const mHash = mandateHash(domain, mandate.body);

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: impostor.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildPublicPolicy(chain, adapter.address, Math.floor(Date.now() / 1000));
    const decision = await verify(mandate, receipt, [], policy);

    expect(decision.ok).toBe(false);
    expect(decision.outcomeClass).toBe("PERMANENT");
    expect(decision.errorCode).toBe("HSP-RCPT-PROOF");
  });

  it("REJECTs a receipt signed by an untrusted adapter key", async () => {
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const trustedAdapterKey = generatePrivateKey();
    const trustedAdapter = privateKeyToAccount(trustedAdapterKey);
    const rogueAdapterKey = generatePrivateKey();
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;

    const mandate = await buildAndSignTestMandate({ payerKey, payee, token, amount });
    const mHash = mandateHash(domain, mandate.body);

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: rogueAdapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildPublicPolicy(chain, trustedAdapter.address, Math.floor(Date.now() / 1000));
    const decision = await verify(mandate, receipt, [], policy);

    expect(decision.ok).toBe(false);
    expect(decision.outcomeClass).toBe("PERMANENT");
    expect(decision.errorCode).toBe("HSP-RCPT-SIG");
  });

  it("REJECTs when the settled amount does not match the signed mandate amount", async () => {
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;

    const mandate = await buildAndSignTestMandate({ payerKey, payee, token, amount: 1_000_000n });
    const mHash = mandateHash(domain, mandate.body);

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: 500_000n,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildPublicPolicy(chain, adapter.address, Math.floor(Date.now() / 1000));
    const decision = await verify(mandate, receipt, [], policy);

    expect(decision.ok).toBe(false);
    expect(decision.errorCode).toBe("HSP-MAND-AMOUNT-OUTOFBOUNDS");
  });

  it("REJECTs settlement after the mandate's deadline", async () => {
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;

    // The deadline must be set BEFORE signing - mutating mandate.body after
    // the signature is produced changes the signed content without
    // re-signing, which (correctly) fails signer verification instead of
    // reaching the deadline check at all. Build the mandate, then re-sign
    // it after overwriting the deadline so the signature actually matches.
    const correctedMandate = await buildAndSignTestMandate({ payerKey, payee, token, amount });
    correctedMandate.body.deadline = Math.floor(Date.now() / 1000) - 10;
    const mHash = mandateHash(domain, correctedMandate.body);
    correctedMandate.signerProof = await signMandateHash(payerKey, mHash);

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildPublicPolicy(chain, adapter.address, Math.floor(Date.now() / 1000));
    const decision = await verify(correctedMandate, receipt, [], policy);

    expect(decision.ok).toBe(false);
    expect(decision.errorCode).toBe("HSP-MAND-EXPIRED");
  });
});

describe("full verify() integration - compliance (KYC) path", () => {
  it("ACCEPTs when a trusted issuer's full-KYC attestation satisfies a basic-KYC requirement", async () => {
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const issuerKey = generatePrivateKey();
    const issuer = privateKeyToAccount(issuerKey);
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;

    const requiredCap = makeCap("attests:kyc:v1", { level: "basic" }, Roles.payer);
    const mandate = await buildAndSignTestMandate({
      payerKey,
      payee,
      token,
      amount,
      requiredCapabilities: [requiredCap.id],
    });
    const mHash = mandateHash(domain, mandate.body);

    const attestation = await issueKyc({
      issuerPrivateKey: issuerKey,
      subject: evmAddressPartyRef(payer.address),
      issuedAt: Math.floor(Date.now() / 1000) - 10,
      expiresAt: 0,
      level: "full",
    });

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildCompliancePolicy(chain, adapter.address, Math.floor(Date.now() / 1000), {
      trustedIssuers: [{ family: "attests:kyc:v1", issuerAddress: issuer.address }],
    });

    const decision = await verify(mandate, receipt, [attestation], policy);

    expect(decision.ok).toBe(true);
    expect(decision.outcomeClass).toBe("ACCEPT");
  });

  it("REJECTs when no attestation is provided for a required KYC capability", async () => {
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const issuerKey = generatePrivateKey();
    const issuer = privateKeyToAccount(issuerKey);
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;

    const requiredCap = makeCap("attests:kyc:v1", { level: "basic" }, Roles.payer);
    const mandate = await buildAndSignTestMandate({
      payerKey,
      payee,
      token,
      amount,
      requiredCapabilities: [requiredCap.id],
    });
    const mHash = mandateHash(domain, mandate.body);

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildCompliancePolicy(chain, adapter.address, Math.floor(Date.now() / 1000), {
      trustedIssuers: [{ family: "attests:kyc:v1", issuerAddress: issuer.address }],
    });

    const decision = await verify(mandate, receipt, [], policy);

    expect(decision.ok).toBe(false);
    expect(decision.errorCode).toBe("HSP-ATT-MISSING");
  });

  it("REJECTs when the attestation comes from an issuer NOT in the trusted set", async () => {
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const trustedIssuerKey = generatePrivateKey();
    const trustedIssuer = privateKeyToAccount(trustedIssuerKey);
    const untrustedIssuerKey = generatePrivateKey();
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;

    const requiredCap = makeCap("attests:kyc:v1", { level: "basic" }, Roles.payer);
    const mandate = await buildAndSignTestMandate({
      payerKey,
      payee,
      token,
      amount,
      requiredCapabilities: [requiredCap.id],
    });
    const mHash = mandateHash(domain, mandate.body);

    const attestation = await issueKyc({
      issuerPrivateKey: untrustedIssuerKey,
      subject: evmAddressPartyRef(payer.address),
      issuedAt: Math.floor(Date.now() / 1000) - 10,
      expiresAt: 0,
      level: "full",
    });

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildCompliancePolicy(chain, adapter.address, Math.floor(Date.now() / 1000), {
      trustedIssuers: [{ family: "attests:kyc:v1", issuerAddress: trustedIssuer.address }],
    });

    const decision = await verify(mandate, receipt, [attestation], policy);

    expect(decision.ok).toBe(false);
    expect(decision.errorCode).toBe("HSP-ATT-ISSUER-UNTRUSTED");
  });

  it("REJECTs when the attestation's subjectBinding does not match the mandate's payer", async () => {
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const someoneElseKey = generatePrivateKey();
    const someoneElse = privateKeyToAccount(someoneElseKey);
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const issuerKey = generatePrivateKey();
    const issuer = privateKeyToAccount(issuerKey);
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;

    const requiredCap = makeCap("attests:kyc:v1", { level: "basic" }, Roles.payer);
    const mandate = await buildAndSignTestMandate({
      payerKey,
      payee,
      token,
      amount,
      requiredCapabilities: [requiredCap.id],
    });
    const mHash = mandateHash(domain, mandate.body);

    const attestation = await issueKyc({
      issuerPrivateKey: issuerKey,
      subject: evmAddressPartyRef(someoneElse.address),
      issuedAt: Math.floor(Date.now() / 1000) - 10,
      expiresAt: 0,
      level: "full",
    });

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildCompliancePolicy(chain, adapter.address, Math.floor(Date.now() / 1000), {
      trustedIssuers: [{ family: "attests:kyc:v1", issuerAddress: issuer.address }],
    });

    const decision = await verify(mandate, receipt, [attestation], policy);

    expect(decision.ok).toBe(false);
    // Structurally admissible (right schema/capId/capSatisfies) - fails at
    // CR2c (subjectBinding != expectedSubject), giving INVALID not MISSING.
    expect(decision.errorCode).toBe("HSP-ATT-INVALID");
  });

  it("REJECTs an expired attestation", async () => {
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const issuerKey = generatePrivateKey();
    const issuer = privateKeyToAccount(issuerKey);
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;

    const requiredCap = makeCap("attests:kyc:v1", { level: "basic" }, Roles.payer);
    const mandate = await buildAndSignTestMandate({
      payerKey,
      payee,
      token,
      amount,
      requiredCapabilities: [requiredCap.id],
    });
    const mHash = mandateHash(domain, mandate.body);

    const attestation = await issueKyc({
      issuerPrivateKey: issuerKey,
      subject: evmAddressPartyRef(payer.address),
      issuedAt: Math.floor(Date.now() / 1000) - 1000,
      expiresAt: Math.floor(Date.now() / 1000) - 10,
      level: "full",
    });

    const receipt = await buildAndSignReceipt({
      domain,
      mandateHash: mHash,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: toHex(crypto.getRandomValues(new Uint8Array(32))),
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const policy = buildCompliancePolicy(chain, adapter.address, Math.floor(Date.now() / 1000), {
      trustedIssuers: [{ family: "attests:kyc:v1", issuerAddress: issuer.address }],
    });

    const decision = await verify(mandate, receipt, [attestation], policy);

    expect(decision.ok).toBe(false);
    // Structurally admissible - fails CR2d (expiry window check), giving
    // INVALID not MISSING.
    expect(decision.errorCode).toBe("HSP-ATT-INVALID");
  });
});

describe("observation reuse (one settlement settles at most one mandate)", () => {
  it("REJECTs a second mandate trying to consume the same on-chain observation", async () => {
    const adapterKey = generatePrivateKey();
    const adapter = privateKeyToAccount(adapterKey);
    const payerKey = generatePrivateKey();
    const payer = privateKeyToAccount(payerKey);
    const payee = "0x2222222222222222222222222222222222222222" as const;
    const token = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
    const amount = 1_000_000n;
    const sharedTxHash = toHex(crypto.getRandomValues(new Uint8Array(32)));

    const policy = buildPublicPolicy(chain, adapter.address, Math.floor(Date.now() / 1000));
    const obsIndex = new ObservationIndex();

    const mandate1 = await buildAndSignTestMandate({ payerKey, payee, token, amount });
    const mHash1 = mandateHash(domain, mandate1.body);
    const receipt1 = await buildAndSignReceipt({
      domain,
      mandateHash: mHash1,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: sharedTxHash,
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const decision1 = await verify(mandate1, receipt1, [], policy, new SeqIndex(), obsIndex);
    expect(decision1.ok).toBe(true);

    const mandate2 = await buildAndSignTestMandate({ payerKey, payee, token, amount });
    const mHash2 = mandateHash(domain, mandate2.body);
    const receipt2 = await buildAndSignReceipt({
      domain,
      mandateHash: mHash2,
      observation: {
        from: payer.address,
        to: payee,
        token,
        value: amount,
        chainId: chain.chainId,
        txHash: sharedTxHash,
        blockNumber: 1n,
      },
      adapterPrivateKey: adapterKey,
      settledAt: Math.floor(Date.now() / 1000),
    });

    const decision2 = await verify(mandate2, receipt2, [], policy, new SeqIndex(), obsIndex);
    expect(decision2.ok).toBe(false);
    expect(decision2.errorCode).toBe("HSP-RCPT-OBS-REUSED");
  });
});
