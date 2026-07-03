import { parseUnits, formatUnits } from "viem";
import {
  validatePayeePolicy,
  validatePaymentAgainstLimits,
  type PayeePolicyInput,
} from "./policyValidator";
import {
  registerPayeeOnChain,
  getPayeePolicyOnChain,
  getRemainingDailyAllowanceOnChain,
} from "../chain/payrollTreasuryClient";
import type { CapabilityKey } from "../config/hsp";
import type { PayeeDirectoryEntry } from "../agents/paymentsAgent/intentParser";

/**
 * Persistence: backed by db/schema.ts's SqlitePayeeRepository (SQLite),
 * imported below. The off-chain identifier->address mapping exists here
 * because PayrollTreasury's on-chain policy mapping is keyed by address,
 * not by human-readable name/handle - see the conversation decision to
 * keep on-chain identifier resolution as a future (V3) item rather than
 * add a fourth contract now.
 */

export interface PayeeRepository {
  findByIdentifier(
    identifier: string
  ): Promise<{ identifier: string; address: `0x${string}` } | null>;
  upsert(identifier: string, address: `0x${string}`): Promise<void>;
  listAll(): Promise<{ identifier: string; address: `0x${string}` }[]>;
}

// Lightweight in-memory implementation, kept available for unit tests that
// should not touch a real SQLite file - NOT used by default anymore, see
// the SqlitePayeeRepository import and instantiation below.
export class InMemoryPayeeRepository implements PayeeRepository {
  private store = new Map<string, `0x${string}`>();

  async findByIdentifier(identifier: string) {
    const address = this.store.get(identifier.toLowerCase());
    return address ? { identifier, address } : null;
  }

  async upsert(identifier: string, address: `0x${string}`) {
    this.store.set(identifier.toLowerCase(), address);
  }

  async listAll() {
    return Array.from(this.store.entries()).map(([identifier, address]) => ({
      identifier,
      address,
    }));
  }
}

import { SqlitePayeeRepository } from "../db/schema";

const payeeRepository: PayeeRepository = new SqlitePayeeRepository();

const TOKEN_DECIMALS = 6; // matches the USDC/USDT decimals used throughout contracts/test fixtures

export interface RegisterPayeeParams {
  identifier: string;
  address: `0x${string}`;
  requiredCapability: CapabilityKey;
  minKycLevel: number;
  perPaymentLimit: string;
  dailyLimit: string;
}

export interface RegisterPayeeResult {
  success: boolean;
  txHash?: `0x${string}`;
  errors?: string[];
}

/**
 * Validates, then registers a payee on-chain (PayrollTreasury.registerPayee)
 * and records the identifier->address mapping off-chain for later lookup.
 * Validation happens BEFORE the on-chain call, per policyValidator's stated
 * rationale - a doomed transaction should never be submitted.
 */
export async function registerPayee(params: RegisterPayeeParams): Promise<RegisterPayeeResult> {
  const validation = validatePayeePolicy(params as PayeePolicyInput);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const txHash = await registerPayeeOnChain({
    payee: params.address,
    requiredCapability: params.requiredCapability as `0x${string}`,
    minKycLevel: params.minKycLevel,
    perPaymentLimit: parseUnits(params.perPaymentLimit, TOKEN_DECIMALS),
    dailyLimit: parseUnits(params.dailyLimit, TOKEN_DECIMALS),
  });

  await payeeRepository.upsert(params.identifier, params.address);

  return { success: true, txHash };
}

/**
 * Resolves a human-readable identifier to an address, for use by
 * intentParser.ts when constructing PayeeDirectoryEntry[] to pass to the
 * payments agent.
 */
export async function getPayeeDirectory(): Promise<PayeeDirectoryEntry[]> {
  const all = await payeeRepository.listAll();
  return all.map((entry) => ({ identifier: entry.identifier, address: entry.address }));
}

export interface PayeeStatusSummary {
  identifier: string;
  address: `0x${string}`;
  active: boolean;
  minKycLevel: number;
  perPaymentLimit: string;
  dailyLimit: string;
  remainingDailyAllowance: string;
}

/**
 * Combines the off-chain identifier mapping with the on-chain policy state -
 * this is the function routes/institutions.routes.ts should call for a
 * "show me this payee's current status" view, since it always reflects
 * the real, current on-chain values rather than a stale off-chain copy.
 */
export async function getPayeeStatus(identifier: string): Promise<PayeeStatusSummary | null> {
  const record = await payeeRepository.findByIdentifier(identifier);
  if (!record) return null;

  const [policy, remaining] = await Promise.all([
    getPayeePolicyOnChain(record.address),
    getRemainingDailyAllowanceOnChain(record.address),
  ]);

  return {
    identifier: record.identifier,
    address: record.address,
    active: policy.active,
    minKycLevel: policy.minKycLevel,
    perPaymentLimit: formatUnits(policy.perPaymentLimit, TOKEN_DECIMALS),
    dailyLimit: formatUnits(policy.dailyLimit, TOKEN_DECIMALS),
    remainingDailyAllowance: formatUnits(remaining, TOKEN_DECIMALS),
  };
}

export async function validateProposedPayment(params: {
  identifier: string;
  amount: string;
}): Promise<{ valid: boolean; errors: string[] }> {
  const status = await getPayeeStatus(params.identifier);
  if (!status) {
    return { valid: false, errors: [`payee "${params.identifier}" is not registered`] };
  }

  if (!status.active) {
    return { valid: false, errors: [`payee "${params.identifier}" is deactivated`] };
  }

  return validatePaymentAgainstLimits({
    amount: params.amount,
    perPaymentLimit: status.perPaymentLimit,
  });
}
