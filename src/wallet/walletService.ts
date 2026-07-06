import { createWalletClient, createPublicClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { env } from "../config/env";
import { buildSignedMandate } from "../hsp/mandateBuilder";
import { hspCoordinatorClient } from "../hsp/coordinatorClient";
import { hspVerifier } from "../hsp/verifierClient";
import { issueKycAttestationDirect } from "../issuer/issuerService";
import { recordAttestationOnChain, isAttestationValid } from "../chain/attestationRegistryClient";
import { CAPABILITY_BYTES32 } from "../config/hsp";
import { logger } from "../utils/logger";

const TESTNET_USDC = "0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6" as const;
const KYC_FULL_CAP_ID = "0xe176eab87495d286f7e5298e98297365377824ecdca366af968570f8230709c6" as Hex;

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: { default: { http: [env.HASHKEY_TESTNET_RPC_URL] } },
});

const ERC20_ABI = [
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export async function callHspFaucet(address: string): Promise<{ success: boolean; txHash?: string; message: string }> {
  try {
    const res = await fetch("https://hsp-hackathon.hashkeymerchant.com/faucet/faucet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, txHash: body.txHash, message: body.txHash ?? "funded" };
    }
    return { success: false, message: body.error ?? `faucet returned ${res.status}` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "faucet request failed" };
  }
}

export async function getHskBalance(address: string): Promise<number> {
  const publicClient = createPublicClient({ chain: hashkeyTestnet, transport: http(env.HASHKEY_TESTNET_RPC_URL) });
  const balance = await publicClient.getBalance({ address: address as `0x${string}` });
  return Number(balance) / 1e18;
}

export async function getTestnetUsdcBalance(address: string): Promise<number> {
  const publicClient = createPublicClient({ chain: hashkeyTestnet, transport: http(env.HASHKEY_TESTNET_RPC_URL) });
  const balance = await publicClient.readContract({
    address: TESTNET_USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });
  return Number(balance) / 1e6;
}

export async function issueKycForWallet(walletAddress: string): Promise<{ txHash: string; alreadyAttested: boolean }> {
  const alreadyValid = await isAttestationValid(
    walletAddress as `0x${string}`,
    CAPABILITY_BYTES32.KYC
  );
  if (alreadyValid) {
    return { txHash: "", alreadyAttested: true };
  }
  const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  const txHash = await recordAttestationOnChain({
    subject: walletAddress as `0x${string}`,
    capability: CAPABILITY_BYTES32.KYC,
    reportTxHash: ("0x" + "ab".repeat(32)) as Hex,
    taskId: ("0x" + "cd".repeat(32)) as Hex,
    kycLevel: 3,
    expiresAt,
  });
  return { txHash, alreadyAttested: false };
}

export interface HspPaymentResult {
  success: boolean;
  paymentId?: string;
  txHash?: string;
  explorerUrl?: string;
  testnetExplorerUrl?: string;
  error?: string;
}

export async function executeCompliantHspPayment(params: {
  payerPrivateKey: string;
  payerAddress: string;
  recipientAddress: string;
  amountUsdc: number;
}): Promise<HspPaymentResult> {
  const { payerPrivateKey, payerAddress, recipientAddress, amountUsdc } = params;
  const amount = parseUnits(amountUsdc.toString(), 6);
  const account = privateKeyToAccount(payerPrivateKey as Hex);
  const walletClient = createWalletClient({ account, chain: hashkeyTestnet, transport: http(env.HASHKEY_TESTNET_RPC_URL) });
  const publicClient = createPublicClient({ chain: hashkeyTestnet, transport: http(env.HASHKEY_TESTNET_RPC_URL) });

  try {
    // POLICY CHECK: verify payer is KYC-attested on mainnet AttestationRegistry
    // before allowing any HSP payment — mainnet contract is the source of truth
    const isKycd = await isAttestationValid(
      payerAddress as `0x${string}`,
      CAPABILITY_BYTES32.KYC
    );
    if (!isKycd) {
      return {
        success: false,
        error: "POLICY_KYC_REQUIRED: This address has no valid KYC attestation on HashKey Chain mainnet. Run /kyc first.",
      };
    }
    const attResult = await issueKycAttestationDirect({ subject: payerAddress as `0x${string}`, kycLevel: 3 });
    const attestation = attResult.hspAttestation;

    const mandate = await buildSignedMandate({
      payer: payerAddress as `0x${string}`,
      payee: recipientAddress as `0x${string}`,
      token: TESTNET_USDC,
      amount,
      requiredCapabilities: [KYC_FULL_CAP_ID],
      signerPrivateKey: payerPrivateKey as Hex,
    });

    const registration = await hspCoordinatorClient.registerMandate(mandate, [attestation]);
    const paymentId = registration.paymentId;

    const txHash = await walletClient.writeContract({
      address: TESTNET_USDC,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [recipientAddress as `0x${string}`, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 2 });

    await hspCoordinatorClient.observePayment(paymentId, txHash);
    await new Promise((r) => setTimeout(r, 5_000));
    const { decision } = await hspVerifier.fetchAndVerify(paymentId);

    if (decision.ok && decision.outcomeClass === "ACCEPT") {
      return {
        success: true,
        paymentId,
        txHash,
        explorerUrl: `https://hsp-hackathon.hashkeymerchant.com/explorer?payment=${paymentId}`,
        testnetExplorerUrl: `https://testnet-explorer.hsk.xyz/tx/${txHash}`,
      };
    }
    return { success: false, error: `Payment not accepted: ${(decision as any).errorCode}` };
  } catch (err) {
    logger.error("HSP payment error", { err });
    return { success: false, error: err instanceof Error ? err.message : "Payment failed" };
  }
}
