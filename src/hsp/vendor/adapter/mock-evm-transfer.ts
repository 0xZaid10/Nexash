// Vendored from project-hsp/hsp packages/core/src/adapter/mock-evm-transfer.ts (Apache-2.0).

import {
  keccak256,
  stringToBytes,
  encodeAbiParameters,
  decodeAbiParameters,
  getAddress,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  receiptHash as computeReceiptHash,
  Outcome,
  RecipientKind,
  type OutcomeValue,
  type Receipt,
  type ReceiptInput,
  type DomainInput,
} from "../core/index";
import type { AdapterProofSchema, VerifyContext, VerifyOutcome } from "../verifier/contracts";

export const EVM_TRANSFER_ADAPTER_ID: Hex = keccak256(stringToBytes("adapter:evm-transfer"));
export const EVM_TRANSFER_PROOF_SCHEMA_ID: Hex = keccak256(stringToBytes("evm-transfer.proof.v1"));
const ZERO32: Hex = `0x${"00".repeat(32)}`;

export interface TransferObservation {
  from: Address;
  to: Address;
  token: Address;
  value: bigint;
  chainId: number;
  txHash: Hex;
  blockNumber: bigint;
}

const PROOF_ABI = [
  { type: "address" },
  { type: "address" },
  { type: "address" },
  { type: "uint256" },
  { type: "uint256" },
  { type: "bytes32" },
  { type: "uint256" },
] as const;

export function encodeTransferProof(o: TransferObservation): Hex {
  return encodeAbiParameters(PROOF_ABI, [o.from, o.to, o.token, o.value, BigInt(o.chainId), o.txHash, o.blockNumber]);
}

export function decodeTransferProof(bytes: Hex): TransferObservation {
  const [from, to, token, value, chainId, txHash, blockNumber] = decodeAbiParameters(PROOF_ABI, bytes);
  return { from, to, token, value, chainId: Number(chainId), txHash, blockNumber };
}

export function transferObservationId(o: Pick<TransferObservation, "chainId" | "token" | "txHash">): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "bytes32" }],
      [BigInt(o.chainId), getAddress(o.token), o.txHash]
    )
  );
}

function fail(errorCode: string): VerifyOutcome {
  return {
    ok: false,
    errorCode,
    proofSatisfiedCapabilities: [],
    amountObservation: { kind: "hidden" },
    recipientObservation: { kind: "shielded" },
  };
}

export const evmTransferSchema: AdapterProofSchema = {
  async verify(ctx: VerifyContext): Promise<VerifyOutcome> {
    let o: TransferObservation;
    try {
      o = decodeTransferProof(ctx.proofBytes);
    } catch {
      return fail("HSP-RCPT-PROOF");
    }
    if (ctx.body.recipient.kind !== RecipientKind.ADDRESS) return fail("HSP-RCPT-PROOF");
    if (ctx.signerSubject.scheme !== "evm-address") return fail("HSP-RCPT-PROOF");
    let signerAddr: Address;
    try {
      signerAddr = getAddress(decodeAbiParameters([{ type: "address" }], ctx.signerSubject.id)[0]);
    } catch {
      return fail("HSP-RCPT-PROOF");
    }
    if (getAddress(o.from) !== signerAddr) return fail("HSP-RCPT-PROOF");

    return {
      ok: true,
      proofSatisfiedCapabilities: [],
      amountObservation: { kind: "exact", value: o.value },
      recipientObservation: { kind: "address", address: getAddress(o.to) },
      tokenObserved: { kind: "evm-address", address: getAddress(o.token) },
      chainIdObserved: o.chainId,
      observationId: transferObservationId(o),
    };
  },
};

export interface BuildReceiptArgs {
  domain: DomainInput;
  mandateHash: Hex;
  observation: TransferObservation;
  adapterPrivateKey: Hex;
  adapterInstanceKey?: Hex;
  seq?: number;
  outcome?: OutcomeValue;
  settledAt: number;
}

export async function buildAndSignReceipt(args: BuildReceiptArgs): Promise<Receipt> {
  const core: ReceiptInput = {
    mandateHash: args.mandateHash,
    adapterId: EVM_TRANSFER_ADAPTER_ID,
    adapterInstanceKey: args.adapterInstanceKey ?? ZERO32,
    seq: args.seq ?? 0,
    outcome: args.outcome ?? Outcome.SETTLED,
    settledAt: args.settledAt,
    proofSchemaId: EVM_TRANSFER_PROOF_SCHEMA_ID,
    adapterProof: encodeTransferProof(args.observation),
  };
  const rHash = computeReceiptHash(args.domain, core);
  const adapterSignature = await privateKeyToAccount(args.adapterPrivateKey).sign({ hash: rHash });
  return { ...core, adapterSignature };
}
