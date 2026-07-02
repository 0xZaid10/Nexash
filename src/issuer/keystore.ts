import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { env } from "../config/env";

/**
 * Deliberately the ONLY file in the backend that touches the issuer's raw
 * private key material. issuerService.ts and everything downstream of it
 * receives a signer object, never the key itself - this keeps the actual
 * secret confined to a single, small, auditable surface.
 */
class IssuerKeystore {
  private readonly account: PrivateKeyAccount;

  constructor(privateKey: `0x${string}`) {
    this.account = privateKeyToAccount(privateKey);
  }

  get address(): `0x${string}` {
    return this.account.address;
  }

  /**
   * Returns the underlying viem account for signing. Callers should treat
   * this as capability-scoped to "sign attestations" - it is not exposed
   * outside the issuer/ module.
   */
  getSigner(): PrivateKeyAccount {
    return this.account;
  }
}

export const issuerKeystore = new IssuerKeystore(
  env.NEXASH_ISSUER_PRIVATE_KEY as `0x${string}`
);

if (issuerKeystore.address.toLowerCase() !== env.NEXASH_ISSUER_ADDRESS.toLowerCase()) {
  throw new Error(
    `NEXASH_ISSUER_PRIVATE_KEY does not correspond to NEXASH_ISSUER_ADDRESS. ` +
      `Derived address: ${issuerKeystore.address}, expected: ${env.NEXASH_ISSUER_ADDRESS}. ` +
      `Refusing to start - this mismatch would mean we sign attestations under a ` +
      `key that is not the one registered as the trusted issuer in the HSP sandbox.`
  );
}
