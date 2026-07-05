// Vendored from project-hsp/hsp packages/core/src/profiles/signer/eip712-eoa.ts (Apache-2.0).
// The ONLY signer profile HSP currently supports - confirmed no EIP-1271/contract
// signer support exists anywhere in core or sdk (see core_source_truth notes).

import {
  keccak256,
  stringToBytes,
  encodeAbiParameters,
  decodeAbiParameters,
  recoverAddress,
  getAddress,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PartyRef, MandateBody } from "../../core/index";
import type { SignerProfile, SignerDecision } from "../../verifier/contracts";

const PROFILE_ID = "eip712-eoa.v1";
const PROFILE_ID_HASH = keccak256(stringToBytes(PROFILE_ID));

const SECP256K1_N_DIV_2 = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;
const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export function evmAddressPartyRef(address: Address): PartyRef {
  return { scheme: "evm-address", id: encodeAbiParameters([{ type: "address" }], [getAddress(address)]) };
}

export const eip712EoaSigner: SignerProfile = {
  profileId: PROFILE_ID,
  profileIdHash: PROFILE_ID_HASH,
  description: {
    profileId: PROFILE_ID,
    signatureSchemes: ["secp256k1-eip712"],
    bindsRequiredCapabilitiesHash: true,
    supportsBatch: false,
    stateDependent: false,
  },

  decode(payload: Hex): PartyRef {
    const address = decodeAbiParameters([{ type: "address" }], payload)[0];
    return evmAddressPartyRef(address);
  },

  async verify(payload: Hex, proof: Hex, mandateHash: Hex, _body: MandateBody): Promise<SignerDecision> {
    let address: Address;
    try {
      address = decodeAbiParameters([{ type: "address" }], payload)[0];
    } catch {
      return { granted: false, errorCode: "HSP-MAND-SIGNER" };
    }
    if (proof.length !== 2 + 65 * 2) {
      return { granted: false, errorCode: "HSP-MAND-SIGNER" };
    }
    const s = BigInt(`0x${proof.slice(66, 130)}`);
    const v = parseInt(proof.slice(130, 132), 16);
    if ((v !== 27 && v !== 28) || s > SECP256K1_N_DIV_2) {
      return { granted: false, errorCode: "HSP-MAND-SIGNER" };
    }
    let recovered: Address;
    try {
      recovered = await recoverAddress({ hash: mandateHash, signature: proof });
    } catch {
      return { granted: false, errorCode: "HSP-MAND-SIGNER" };
    }
    if (getAddress(recovered) === ZERO_ADDRESS || getAddress(recovered) !== getAddress(address)) {
      return { granted: false, errorCode: "HSP-MAND-SIGNER" };
    }
    return { granted: true, resolvedSubject: evmAddressPartyRef(address) };
  },
};

export async function signMandateHash(privateKey: Hex, mandateHash: Hex): Promise<Hex> {
  return privateKeyToAccount(privateKey).sign({ hash: mandateHash });
}
