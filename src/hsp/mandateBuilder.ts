import { encodeAbiParameters, toHex, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config/env";
import { hspConfig } from "../config/hsp";
import { mandateHash, requiredCapabilitiesHash, type MandateBodyInput } from "./vendor/derivations";
import { signMandateHash, eip712EoaSigner } from "./vendor/profiles/signer/eip712-eoa";
import type { SignedMandate } from "./vendor/core/types";

// Backend operator EOA - the only signer HSP's eip712-eoa.v1 profile accepts
// (see payments.routes.ts's architecture note - no contract signer support).
const operatorAccount = privateKeyToAccount(env.BACKEND_SIGNER_PRIVATE_KEY as `0x${string}`);

export interface BuildMandateParams {
  payer: `0x${string}`;
  payee: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  requiredCapabilities: Hash[];
  validitySeconds?: number;
  signerPrivateKey?: `0x${string}`;
}

const DEFAULT_MANDATE_VALIDITY_SECONDS = 15 * 60;

function generateNonce(): Hash {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(randomBytes) as Hash;
}

export async function buildSignedMandate(params: BuildMandateParams): Promise<SignedMandate> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const deadline = issuedAt + (params.validitySeconds ?? DEFAULT_MANDATE_VALIDITY_SECONDS);

  const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  const body: MandateBodyInput = {
    nonce: generateNonce(),
    signer: {
      profileId: eip712EoaSigner.profileIdHash,
      payload: encodeAbiParameters([{ type: "address" }], [params.payer]),
    },
    grantRef: ZERO32,
    requirementRef: ZERO32,
    recipient: {
      kind: 0,
      payload: encodeAbiParameters([{ type: "address" }], [params.payee]),
    },
    token: params.token,
    amount: params.amount.toString(),
    chainId: hspConfig.chain.id,
    deadline,
    settlementBinding: ZERO32,
    requiredCapabilitiesHash: requiredCapabilitiesHash(params.requiredCapabilities),
  };

  const domain = {
    name: "HSP",
    version: "1",
    chainId: hspConfig.chain.id,
    verifyingContract: hspConfig.trust.verifyingContract as `0x${string}`,
  };

  const privateKey = (params.signerPrivateKey ?? env.BACKEND_SIGNER_PRIVATE_KEY) as `0x${string}`;
  const mHash = mandateHash(domain, body);
  const signerProof = await signMandateHash(privateKey, mHash);

  return {
    body,
    signerProof,
    requiredCapabilities: params.requiredCapabilities,
  };
}

export function getOperatorAddress(): `0x${string}` {
  return operatorAccount.address;
}
