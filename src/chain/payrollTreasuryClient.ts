import { createPublicClient, createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { activeChain } from "../config/chains";
import { env } from "../config/env";
import payrollTreasuryAbi from "./abi/PayrollTreasury.json";

const operatorAccount = privateKeyToAccount(env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({ chain: activeChain, transport: http() });
const walletClient = createWalletClient({
  chain: activeChain,
  transport: http(),
  account: operatorAccount,
});

const TREASURY_ADDRESS = env.PAYROLL_TREASURY_ADDRESS as `0x${string}`;

export interface OnChainPayeePolicy {
  payee: `0x${string}`;
  requiredCapability: Hash;
  minKycLevel: number;
  perPaymentLimit: bigint;
  dailyLimit: bigint;
  active: boolean;
}

export async function registerPayeeOnChain(params: {
  payee: `0x${string}`;
  requiredCapability: Hash;
  minKycLevel: number;
  perPaymentLimit: bigint;
  dailyLimit: bigint;
}): Promise<Hash> {
  const txHash = await walletClient.writeContract({
    address: TREASURY_ADDRESS,
    abi: payrollTreasuryAbi,
    functionName: "registerPayee",
    args: [
      params.payee,
      params.requiredCapability,
      params.minKycLevel,
      params.perPaymentLimit,
      params.dailyLimit,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * The function that actually moves funds. This is deliberately the ONLY
 * function in the whole backend that calls PayrollTreasury.releasePayment -
 * routes/payments should call this, never construct the writeContract call
 * inline elsewhere, so there is exactly one auditable code path that can
 * trigger a real fund release.
 *
 * Does NOT check compliance itself - that check already happened on-chain,
 * inside releasePayment's own logic (it calls AttestationRegistry directly).
 * This function will simply revert if compliance isn't satisfied; it is not
 * this function's job to pre-check that, only to submit the tx and surface
 * whatever the chain decides.
 */
export async function releasePaymentOnChain(params: {
  payee: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  mandateHash: Hash;
}): Promise<Hash> {
  const txHash = await walletClient.writeContract({
    address: TREASURY_ADDRESS,
    abi: payrollTreasuryAbi,
    functionName: "releasePayment",
    args: [params.payee, params.token, params.amount, params.mandateHash],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function getPayeePolicyOnChain(payee: `0x${string}`): Promise<OnChainPayeePolicy> {
  return publicClient.readContract({
    address: TREASURY_ADDRESS,
    abi: payrollTreasuryAbi,
    functionName: "getPayeePolicy",
    args: [payee],
  }) as Promise<OnChainPayeePolicy>;
}

export async function getRemainingDailyAllowanceOnChain(payee: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: TREASURY_ADDRESS,
    abi: payrollTreasuryAbi,
    functionName: "getRemainingDailyAllowance",
    args: [payee],
  }) as Promise<bigint>;
}

export async function isMandateSettledOnChain(mandateHash: Hash): Promise<boolean> {
  return publicClient.readContract({
    address: TREASURY_ADDRESS,
    abi: payrollTreasuryAbi,
    functionName: "isMandateSettled",
    args: [mandateHash],
  }) as Promise<boolean>;
}

export async function getTreasuryBalance(token: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: TREASURY_ADDRESS,
    abi: payrollTreasuryAbi,
    functionName: "balanceOf",
    args: [token],
  }) as Promise<bigint>;
}
