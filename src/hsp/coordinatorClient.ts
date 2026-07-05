import { hspConfig } from "../config/hsp";
import type { DeploymentInfo, PaymentRecord, SignedMandate } from "./types";

/**
 * Thin REST client over the HSP Coordinator. Per HSP's own trust model
 * (README.md "Trust model in one paragraph"), nothing returned from this
 * client should be treated as final truth - verifierClient.ts re-checks
 * every payment independently. This client's job is purely to talk to the
 * Coordinator's documented endpoints (§3 of developer_guide.md), not to
 * make trust decisions.
 */
class HspCoordinatorClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private authHeaders(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  /**
   * GET /chains - confirms the deployment's advertised chain config.
   * Used by verifierClient's assertDeployment-equivalent check, never
   * trusted blindly on its own.
   */
  async getDeploymentInfo(chain: string): Promise<DeploymentInfo> {
    const res = await fetch(`${this.baseUrl}/chains`);
    if (!res.ok) {
      throw new Error(`HSP /chains request failed: ${res.status} ${res.statusText}`);
    }
    const body = await res.json();
    const match = (body?.chains ?? []).find((c: any) => c.chain === chain);
    if (!match) {
      throw new Error(`Coordinator at ${this.baseUrl} does not advertise chain "${chain}"`);
    }
    return match as DeploymentInfo;
  }

  /**
   * POST /payments - registers a signed mandate. paymentId is the mandate
   * hash; this call is idempotent per HSP's documented semantics.
   */
  async registerMandate(
    mandate: SignedMandate,
    attestations: unknown[] = []
  ): Promise<{ paymentId: string; status: string }> {
    // Coordinator wire shape confirmed from /docs example:
    // { chain, mandate: { body, signature }, attestations }
    // Our SignedMandate type uses 'signerProof' internally (matching
    // @hsp/core's type) but the Coordinator's REST API calls it 'signature'.
    const wireMandate = {
      body: mandate.body,
      signerProof: mandate.signerProof,
      requiredCapabilities: mandate.requiredCapabilities,
    };

    const payload = {
      chain: hspConfig.chainName,
      mandate: wireMandate,
      attestations,
    };

    const res = await fetch(`${this.baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`HSP POST /payments failed: ${res.status} ${errBody}`);
    }

    return res.json();
  }

  /**
   * POST /payments/:id/observe - prompts the Coordinator's adapter to check
   * for settlement. Returns 200 if observed+verified, 202 if still
   * confirming (caller should retry), per documented semantics.
   */
  async observePayment(paymentId: string, txHash?: string): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`${this.baseUrl}/payments/${paymentId}/observe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify(txHash ? { txHash } : {}),
    });

    return { status: res.status, body: await res.json().catch(() => null) };
  }

  /**
   * GET /payments/:id - public read, no API key required. Returns the full
   * (mandate, receipts, attestations) triple needed for independent
   * verification.
   */
  async getPayment(paymentId: string): Promise<PaymentRecord> {
    const res = await fetch(`${this.baseUrl}/payments/${paymentId}`);
    if (!res.ok) {
      throw new Error(`HSP GET /payments/${paymentId} failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * GET /payments/:id/explain - the label-resolved decision trace shown in
   * the HSP Explorer UI, also useful as a raw API for our own backend.
   */
  async explainPayment(paymentId: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/payments/${paymentId}/explain`);
    if (!res.ok) {
      throw new Error(`HSP GET /payments/${paymentId}/explain failed: ${res.status}`);
    }
    return res.json();
  }
}

export const hspCoordinatorClient = new HspCoordinatorClient(
  hspConfig.coordinatorUrl,
  hspConfig.apiKey
);
