import { createWalletClient, createPublicClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { env } from "../src/config/env";
import { buildSignedMandate } from "../src/hsp/mandateBuilder";
import { hspCoordinatorClient } from "../src/hsp/coordinatorClient";
import { hspVerifier } from "../src/hsp/verifierClient";
import { issueKycAttestationDirect } from "../src/issuer/issuerService";

// Confirmed from GET /issuer/attest/kyc — the real capabilityId for attests:kyc:v1[level=full]
// role-wrapped (mandate) and base (attestation capabilityId) - confirmed 2026-07-09
const COORDINATOR_KYC_CAP_ID = "0xe176eab87495d286f7e5298e98297365377824ecdca366af968570f8230709c6" as Hex;
const KYC_BASE_ID = "0x232e9f37db21a178d9598188ea9294473f2f8897d058c7d382dd465e9d100469" as Hex;
const COORDINATOR_KYC_SCHEMA_ID = "0xedc9e4b795c2d81b19fe5080310f148e7f853b18b6e8c4cb190b6ee4d2b7e541" as Hex;
const TESTNET_USDC = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
const RECIPIENT = "0x2222222222222222222222222222222222222222" as const;
const AMOUNT = parseUnits("1", 6);

const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: { default: { http: [env.HASHKEY_TESTNET_RPC_URL] } },
});

const ERC20_ABI = [
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

function section(name: string) { console.log(`\n=== ${name} ===`); }
function pass(msg: string) { console.log(`PASS: ${msg}`); }
function fail(msg: string, err: unknown) { console.log(`FAIL: ${msg}\n${err instanceof Error ? err.message : err}`); }

async function main() {
  // Use our registered issuer key as the payer — same key signs mandate AND attestation
  const account = privateKeyToAccount(env.NEXASH_ISSUER_PRIVATE_KEY as Hex);
  const walletClient = createWalletClient({ account, chain: hashkeyTestnet, transport: http(env.HASHKEY_TESTNET_RPC_URL) });
  const publicClient = createPublicClient({ chain: hashkeyTestnet, transport: http(env.HASHKEY_TESTNET_RPC_URL) });

  section("1. Testnet USDC balance");
  console.log("Payer/signer:", account.address, "(0xb625c469... — our registered Nexash issuer)");
  const balance = await publicClient.readContract({ address: TESTNET_USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] });
  console.log(`Balance: ${Number(balance) / 1e6} USDC`);
  if (balance < AMOUNT) {
    console.log("FAIL: insufficient USDC — run faucet for this address first:");
    console.log(`curl -X POST -H 'content-type: application/json' -d '{"address":"${account.address}"}' https://hsp-hackathon.hashkeymerchant.com/faucet/faucet`);
    process.exit(1);
  }
  pass("Balance sufficient");

  section("2. Issue KYC attestation — signed by OUR registered issuer key");
  let attestation: any;
  try {
    const result = await issueKycAttestationDirect({ subject: account.address, kycLevel: 3 });
    attestation = result.hspAttestation;
    console.log("Issuer key:", account.address);
    console.log("capabilityId:", attestation.capabilityId);
    console.log("issuerKeyId:", attestation.issuerKeyId);
    pass("Attestation signed by our registered issuer key");
  } catch (err) {
    fail("issueKycAttestationDirect", err);
    process.exit(1);
  }

  section("3. Build compliant mandate — requires attests:kyc:v1");
  const mandate = await buildSignedMandate({
    payer: account.address,
    payee: RECIPIENT,
    token: TESTNET_USDC,
    amount: AMOUNT,
    requiredCapabilities: [COORDINATOR_KYC_CAP_ID],
    signerPrivateKey: env.NEXASH_ISSUER_PRIVATE_KEY as Hex,
  });
  console.log("Payer:", account.address);
  console.log("Required cap:", COORDINATOR_KYC_CAP_ID, "(attests:kyc:v1[level=full])");
  pass("Compliant mandate built");

  section("4. Register mandate + our attestation with Coordinator");
  let paymentId: string;
  try {
    const registration = await hspCoordinatorClient.registerMandate(mandate, [attestation]);
    paymentId = registration.paymentId;
    console.log("paymentId:", paymentId);
    console.log("status:", registration.status);
    pass("Registered with Coordinator");
  } catch (err) {
    fail("registerMandate", err);
    process.exit(1);
  }

  section("5. Send on-chain ERC-20 transfer (testnet) from our issuer address");
  let txHash: Hex;
  try {
    txHash = await walletClient.writeContract({
      address: TESTNET_USDC,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [RECIPIENT, AMOUNT],
    });
    console.log("txHash:", txHash);
    console.log("Waiting for 2 confirmations...");
    await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 2 });
    pass("Transfer confirmed on-chain");
  } catch (err) {
    fail("on-chain transfer", err);
    process.exit(1);
  }

  section("6. Observe settlement with Coordinator");
  try {
    const observed = await hspCoordinatorClient.observePayment(paymentId, txHash);
    console.log("Observe response:", JSON.stringify(observed, null, 2));
    if (observed.status === 200) {
      pass("Settlement observed and receipt signed");
    } else {
      console.log("202 - still confirming, waiting 20s...");
      await new Promise((r) => setTimeout(r, 20_000));
    }
  } catch (err) {
    fail("observe", err);
    await new Promise((r) => setTimeout(r, 20_000));
  }

  section("7. Independent verification");
  try {
    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`Attempt ${attempt}/5...`);
      await new Promise((r) => setTimeout(r, 5_000));
      try {
        const { decision } = await hspVerifier.fetchAndVerify(paymentId);
        console.log("Decision:", JSON.stringify(decision, null, 2));
        if (decision.ok && decision.outcomeClass === "ACCEPT") {
          pass("ACCEPT — HSP payment verified with our registered Nexash issuer key!");
          console.log(`\nExplorer: https://hsp-hackathon.hashkeymerchant.com/explorer?payment=${paymentId}`);
          return;
        } else if ((decision as any).outcomeClass === "RETRYABLE") {
          console.log("RETRYABLE, waiting...");
        } else {
          fail("not ACCEPT", `outcomeClass: ${(decision as any).outcomeClass}, errorCode: ${(decision as any).errorCode}`);
          return;
        }
      } catch (err) {
        if ((err as Error).message?.includes("no receipts")) { continue; }
        throw err;
      }
    }
    console.log(`Check Explorer: https://hsp-hackathon.hashkeymerchant.com/explorer?payment=${paymentId}`);
  } catch (err) {
    fail("verify", err);
  }

  console.log("\n=== Done ===");
}

main();
