import { verify, SeqIndex, ObservationIndex } from "./vendor/verifier/index";
import { buildCompliancePolicy } from "./vendor/policy/compliance";
import type { AcceptDecision } from "./vendor/verifier/contracts";
import type { SignedMandate, Receipt, Attestation } from "./vendor/core/types";
import type { HspChainConfig } from "./vendor/policy/public";
import type { CompliancePolicyOpts } from "./vendor/policy/compliance";
import { hspCoordinatorClient } from "./coordinatorClient";
import { hspConfig } from "../config/hsp";
import type { PaymentRecord } from "./types";
import type { Address } from "viem";

// Real HSPVerifier, mirroring @hsp/sdk's PinnedTrustConfig shape.
export interface PinnedTrustConfig {
  chain: HspChainConfig;
  adapterAddress: Address;
  compliance?: CompliancePolicyOpts;
}

const pinned: PinnedTrustConfig = {
  chain: {
    chainId: hspConfig.chain.id,
    verifyingContract: hspConfig.trust.verifyingContract as Address,
    adapterInstanceKey:
      "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
  },
  adapterAddress: hspConfig.trust.adapterAddress as Address,
  compliance: {
    trustedIssuers: [
      ...hspConfig.trust.trustedIssuers["attests:kyc:v1"].map((i) => ({
        family: "attests:kyc:v1" as const,
        issuerAddress: i.issuerAddress as Address,
      })),
      ...hspConfig.trust.trustedIssuers["attests:sanctions:v1"].map((i) => ({
        family: "attests:sanctions:v1" as const,
        issuerAddress: i.issuerAddress as Address,
      })),
    ],
  },
};

class NexashHspVerifier {
  async verify(
    mandate: SignedMandate,
    receipt: Receipt,
    attestations: Attestation[] = [],
    seqIndex: SeqIndex = new SeqIndex(),
    obsIndex: ObservationIndex = new ObservationIndex()
  ): Promise<AcceptDecision> {
    const now = Math.floor(Date.now() / 1000);
    const policy = buildCompliancePolicy(
      pinned.chain,
      pinned.adapterAddress,
      now,
      pinned.compliance ?? { trustedIssuers: [] }
    );
    return verify(mandate, receipt, attestations, policy, seqIndex, obsIndex);
  }

  async fetchAndVerify(paymentId: string): Promise<{ payment: PaymentRecord; decision: AcceptDecision }> {
    const payment = await hspCoordinatorClient.getPayment(paymentId);
    const lastReceipt = payment.receipts[payment.receipts.length - 1]?.receipt;
    if (!lastReceipt) {
      throw new Error(`Payment ${paymentId} has no receipts yet`);
    }
    const decision = await this.verify(payment.mandate, lastReceipt, payment.attestations);
    return { payment, decision };
  }
}

export const hspVerifier = new NexashHspVerifier();
