import { CAPABILITY, type CapabilityKey } from "../config/hsp";

export interface PayeePolicyInput {
  identifier: string;
  address: `0x${string}`;
  requiredCapability: CapabilityKey;
  minKycLevel: number;
  perPaymentLimit: string;
  dailyLimit: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const MIN_KYC_LEVEL = 0;
const MAX_KYC_LEVEL = 4; // mirrors CapabilityTypes.KycLevel enum (NONE..ULTIMATE)

/**
 * Pure validation - no database, no chain call, no network access. This
 * exists so payeeService.ts can reject obviously-bad input BEFORE spending
 * a real on-chain transaction (registerPayee) attempting to register it,
 * since contract reverts cost real gas and produce a less useful error
 * message than catching the same problem here first.
 */
export function validatePayeePolicy(input: PayeePolicyInput): ValidationResult {
  const errors: string[] = [];

  if (!input.identifier || input.identifier.trim().length === 0) {
    errors.push("identifier must not be empty");
  }

  if (!ADDRESS_REGEX.test(input.address)) {
    errors.push(`address "${input.address}" is not a valid EVM address`);
  }

  if (!Object.values(CAPABILITY).includes(input.requiredCapability)) {
    errors.push(`requiredCapability "${input.requiredCapability}" is not a recognized capability`);
  }

  if (
    !Number.isInteger(input.minKycLevel) ||
    input.minKycLevel < MIN_KYC_LEVEL ||
    input.minKycLevel > MAX_KYC_LEVEL
  ) {
    errors.push(`minKycLevel must be an integer between ${MIN_KYC_LEVEL} and ${MAX_KYC_LEVEL}`);
  }

  const perPaymentLimitNum = Number(input.perPaymentLimit);
  if (!Number.isFinite(perPaymentLimitNum) || perPaymentLimitNum <= 0) {
    errors.push("perPaymentLimit must be a positive number");
  }

  const dailyLimitNum = Number(input.dailyLimit);
  if (!Number.isFinite(dailyLimitNum) || dailyLimitNum <= 0) {
    errors.push("dailyLimit must be a positive number");
  }

  if (
    Number.isFinite(perPaymentLimitNum) &&
    Number.isFinite(dailyLimitNum) &&
    perPaymentLimitNum > dailyLimitNum
  ) {
    errors.push(
      "perPaymentLimit cannot exceed dailyLimit - a single payment could never " +
        "be made if it always exceeds the daily allowance"
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a proposed payment amount against a payee's policy BEFORE
 * attempting on-chain release - same rationale as above, catch what we can
 * here first so a doomed transaction never gets submitted.
 *
 * This intentionally does NOT check compliance/attestation status - that is
 * exclusively AttestationRegistry's job, on-chain, at release time. This
 * function only catches the kind of error that policy data alone can
 * determine, without needing the current attestation state.
 */
export function validatePaymentAgainstLimits(params: {
  amount: string;
  perPaymentLimit: string;
}): ValidationResult {
  const errors: string[] = [];
  const amountNum = Number(params.amount);
  const limitNum = Number(params.perPaymentLimit);

  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    errors.push("amount must be a positive number");
  }

  if (Number.isFinite(amountNum) && amountNum > limitNum) {
    errors.push(
      `amount ${params.amount} exceeds this payee's perPaymentLimit ${params.perPaymentLimit} - ` +
        `this would revert on-chain (PerPaymentLimitExceeded), caught here first instead`
    );
  }

  return { valid: errors.length === 0, errors };
}
