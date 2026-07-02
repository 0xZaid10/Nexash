import { parsePaymentIntent } from "../src/agents/paymentsAgent/intentParser";
import { reviewPaymentBatch } from "../src/agents/paymentsAgent/anomalyReview";
import { reasonAboutMarket } from "../src/agents/tradingAgent/marketReasoning";
import { buildRichSnapshot } from "../src/market/marketSnapshot";
import { createPaperPortfolio, applyPaperTrade } from "../src/agents/tradingAgent/paperPortfolio";
import { hspCoordinatorClient } from "../src/hsp/coordinatorClient";
import { buildSignedMandate, getOperatorAddress } from "../src/hsp/mandateBuilder";
import { hspVerifier } from "../src/hsp/verifierClient";
import { makeCap } from "../src/hsp/vendor/core/capabilities";
import { createPublicClient, http } from "viem";
import { env } from "../src/config/env";
import { activeChain } from "../src/config/chains";
import { attestationRegistryClient } from "../src/chain/attestationRegistryClient";

function section(name: string) {
  console.log(`\n=== ${name} ===`);
}

function pass(msg: string) {
  console.log(`PASS: ${msg}`);
}

function fail(msg: string, err: unknown) {
  console.log(`FAIL: ${msg}`);
  console.log(err instanceof Error ? err.message : err);
}

async function step1_intentParser() {
  section("1. intentParser - real Venice call");
  try {
    const result = await parsePaymentIntent({
      instruction: "pay alice 500 USDC and bob 300 USDC, hold bob's until his KYC renews",
      payeeDirectory: [
        { identifier: "alice", address: "0x1111111111111111111111111111111111111111" },
        { identifier: "bob", address: "0x2222222222222222222222222222222222222222" },
      ],
    });
    console.log(JSON.stringify(result, null, 2));
    pass("intentParser returned a structured result");
    return result;
  } catch (err) {
    fail("intentParser", err);
    return null;
  }
}

async function step2_anomalyReview(
  proposedPayments: Awaited<ReturnType<typeof parsePaymentIntent>>["proposedPayments"]
) {
  section("2. anomalyReview - real Venice call");
  try {
    const result = await reviewPaymentBatch({
      proposedPayments,
      payeeHistory: [
        {
          payeeIdentifier: "alice",
          pastAmounts: ["500", "500", "500"],
          lastPaymentTimestamp: Date.now() / 1000 - 86400 * 30,
        },
        { payeeIdentifier: "bob", pastAmounts: [], lastPaymentTimestamp: null },
      ],
    });
    console.log(JSON.stringify(result, null, 2));
    pass("anomalyReview returned a structured result");
  } catch (err) {
    fail("anomalyReview", err);
  }
}

async function step3_marketReasoning() {
  section("3. marketReasoning - real Venice call + real HashKey Exchange data + indicators");
  try {
    const snap = await buildRichSnapshot("BTCUSDT");
    const tf1h = snap.timeframes.find((t) => t.interval === "1h")?.indicators;
    console.log("Live ticker:", { pair: snap.pair, lastPrice: snap.lastPrice, change24hPct: snap.change24hPct });
    if (tf1h) console.log("1h indicators:", { trend: tf1h.trend, rsi14: tf1h.rsi14?.toFixed(1), rsiZone: tf1h.rsiZone });

    const result = await reasonAboutMarket({
      userQuestion: "should I consider a small long position right now?",
      pair: "BTCUSDT",
    });
    console.log(JSON.stringify(result, null, 2));
    pass("marketReasoning returned a structured result from live market data with indicators");
    return { result, price: Number(snap.lastPrice) };
  } catch (err) {
    fail("marketReasoning / exchangeClient", err);
    return null;
  }
}

function step4_paperTrade(
  proposedAction: { side: "buy" | "sell"; pair: string; sizeFraction: number } | null,
  price: number
) {
  section("4. paperPortfolio - simulate the proposed trade");
  if (!proposedAction) {
    console.log("SKIP: marketReasoning proposed no action");
    return;
  }
  try {
    const portfolio = createPaperPortfolio("smoke-test-user", 10_000);
    const result = applyPaperTrade(portfolio, proposedAction, price);
    console.log(JSON.stringify(result, null, 2));
    pass("paper trade simulated, no real funds touched");
  } catch (err) {
    fail("paperPortfolio", err);
  }
}

async function step5_hspRoundTrip() {
  section("5. HSP mandate build + Coordinator registration + our verifier");
  try {
    const kycCap = makeCap("attests:kyc:v1", { level: "basic" });
    const mandate = await buildSignedMandate({
      payer: getOperatorAddress(),
      payee: "0x2222222222222222222222222222222222222222",
      token: "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6",
      amount: 1000n,
      requiredCapabilities: [], // public path first - isolate whether 500 is cap-related
    });
    console.log("Mandate built, signer:", getOperatorAddress());

    const registration = await hspCoordinatorClient.registerMandate(mandate);
    console.log("Coordinator response:", JSON.stringify(registration, null, 2));
    pass("Mandate registered with the live HSP sandbox Coordinator");

    await hspCoordinatorClient.observePayment(registration.paymentId);
    const { decision } = await hspVerifier.fetchAndVerify(registration.paymentId);
    console.log("Our independent verify() decision:", JSON.stringify(decision, null, 2));
    pass("Our own verifier ran against the live Coordinator's data");
  } catch (err) {
    fail("HSP round trip", err);
  }
}

async function step6_onChainIssuerCheck() {
  section("6. On-chain issuer verification - AttestationRegistry on mainnet");
  try {
    const client = createPublicClient({
      chain: activeChain,
      transport: http(env.HASHKEY_MAINNET_RPC_URL),
    });

    const REGISTRY = env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`;
    const ISSUER = env.NEXASH_ISSUER_ADDRESS as `0x${string}`;

    const isIssuer = await client.readContract({
      address: REGISTRY,
      abi: [{
        name: "isIssuer",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "issuer", type: "address" }],
        outputs: [{ type: "bool" }],
      }],
      functionName: "isIssuer",
      args: [ISSUER],
    });

    console.log("AttestationRegistry:", REGISTRY);
    console.log("Issuer address:", ISSUER);
    console.log("isIssuer result:", isIssuer);

    if (isIssuer) {
      pass("Issuer is correctly registered on AttestationRegistry (mainnet)");
    } else {
      fail("Issuer NOT registered on AttestationRegistry", "isIssuer returned false");
    }
  } catch (err) {
    fail("on-chain issuer check", err);
  }
}

async function step7_payrollTreasuryCheck() {
  section("7. PayrollTreasury on-chain read - verify registry link");
  try {
    const client = createPublicClient({
      chain: activeChain,
      transport: http(env.HASHKEY_MAINNET_RPC_URL),
    });

    const TREASURY = env.PAYROLL_TREASURY_ADDRESS as `0x${string}`;
    const REGISTRY = env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`;

    const linkedRegistry = await client.readContract({
      address: TREASURY,
      abi: [{
        name: "attestationRegistry",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "address" }],
      }],
      functionName: "attestationRegistry",
    });

    console.log("PayrollTreasury:", TREASURY);
    console.log("Linked registry:", linkedRegistry);
    console.log("Expected registry:", REGISTRY);

    if ((linkedRegistry as string).toLowerCase() === REGISTRY.toLowerCase()) {
      pass("PayrollTreasury correctly linked to AttestationRegistry on-chain");
    } else {
      fail("PayrollTreasury registry mismatch", `got ${linkedRegistry}, expected ${REGISTRY}`);
    }
  } catch (err) {
    fail("PayrollTreasury on-chain read", err);
  }
}

async function main() {
  const intentResult = await step1_intentParser();
  if (intentResult) await step2_anomalyReview(intentResult.proposedPayments);

  const marketResult = await step3_marketReasoning();
  if (marketResult) step4_paperTrade(marketResult.result.proposedAction, marketResult.price);

  await step5_hspRoundTrip();
  await step6_onChainIssuerCheck();
  await step7_payrollTreasuryCheck();

  console.log("\n=== Done. Review PASS/FAIL above. ===");
}

main();
