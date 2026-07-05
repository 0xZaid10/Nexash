import { createPublicClient, http, type Hash } from "viem";
import { activeChain } from "../config/chains";
import { nexaidConfig } from "../config/nexaid";

const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(),
});

export interface NexaidReportCheckResult {
  exists: boolean;
  confirmed: boolean;
  blockNumber: bigint | null;
  reportTxHash: Hash;
}

/**
 * Independently confirms a NexaID reportTxHash exists and is confirmed on
 * HashKey Chain, WITHOUT trusting NexaID's API to tell us so - this is the
 * "trustless anchor" property the whole issuer pipeline depends on (see
 * hackathon_refs/nexaid/ - the same trust pattern V1 Nexash already
 * validated against Binance KYC attestations).
 *
 * This function deliberately does NOT attempt to decode/verify the
 * attestation payload itself - that lives in the NexaID node's signed
 * result. It only confirms the transaction is real and mined, which is the
 * minimum bar before we proceed to check the claimed kycLevel/taskId against
 * what NexaID's API reports for that same task.
 */
export async function confirmReportOnChain(
  reportTxHash: Hash
): Promise<NexaidReportCheckResult> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: reportTxHash });

    return {
      exists: true,
      confirmed: receipt.status === "success",
      blockNumber: receipt.blockNumber,
      reportTxHash,
    };
  } catch (err) {
    return {
      exists: false,
      confirmed: false,
      blockNumber: null,
      reportTxHash,
    };
  }
}

export interface NexaidTaskResult {
  taskId: string;
  kycStatus: string;
  userId: string;
  passKycLevel: number;
}

/**
 * Fetches the task result from NexaID's API for cross-checking against the
 * on-chain reportTxHash. This call IS trusted in the sense that we rely on
 * NexaID's API to report accurate task data - the on-chain confirmation
 * above is what prevents a forged/non-existent reportTxHash from being
 * accepted, but the actual KYC outcome still comes from NexaID's attestor
 * network, same as the GitBook docs describe.
 *
 * UNVERIFIED ASSUMPTION - MUST CONFIRM BEFORE PRODUCTION USE:
 * 1. The endpoint path "/developer-center/public/task/{taskId}" is inferred
 *    by analogy to the SDK's confirmed schema-lookup endpoint
 *    ("/developer-center/public/schema/{id}") - it has NOT been confirmed to
 *    actually exist. Inspect the SDK bundle (dist/index-*.mjs) for the real
 *    task-result endpoint before relying on this.
 * 2. The possible string values of kycStatus (assumed "PASS"/"VERIFIED"
 *    below) are NOT confirmed - the docs only showed the jsonPath
 *    "$.data.kycStatus" pointing at a field, never its actual possible
 *    values. Confirm real values from a live attestation response before
 *    this gates real attestations.
 */
export async function fetchNexaidTaskResult(taskId: string): Promise<NexaidTaskResult> {
  const url = `${nexaidConfig.mainnet.apiUrl}/developer-center/public/task/${taskId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `NexaID task lookup failed (${response.status} ${response.statusText}). ` +
        `URL: ${url}. If 404, the endpoint path may differ from what's expected - ` +
        `confirm the real task-result endpoint from the NexaID SDK or docs.`
    );
  }

  const body = await response.json();

  if (!body?.result) {
    throw new Error(
      `NexaID task ${taskId} returned no result field. ` +
        `Full response: ${JSON.stringify(body).slice(0, 300)}`
    );
  }

  const kycStatus = body.result.kycStatus;
  if (!kycStatus || typeof kycStatus !== "string") {
    throw new Error(
      `NexaID task ${taskId} response missing kycStatus field. ` +
        `result keys: ${Object.keys(body.result ?? {}).join(", ")}`
    );
  }

  return {
    taskId,
    kycStatus,
    userId: body.result.userId,
    passKycLevel: Number(body.result.passKycLevel),
  };
}

export interface VerifiedKycAttestation {
  subject: `0x${string}`;
  kycLevel: number;
  reportTxHash: Hash;
  taskId: string;
  verifiedAt: number;
}

/**
 * The full pre-signing check: confirm the report exists on-chain AND that
 * NexaID's API agrees on the task outcome, before issuerService is allowed
 * to sign anything. Throws on any failure - issuerService must not catch
 * and silently proceed.
 */
export async function verifyKycReportBeforeIssuing(params: {
  subject: `0x${string}`;
  reportTxHash: Hash;
  taskId: string;
  templateId: string;
}): Promise<VerifiedKycAttestation> {
  const { subject, reportTxHash, taskId, templateId } = params;

  if (templateId !== nexaidConfig.kycTemplate.templateId) {
    throw new Error(
      `Refusing to issue attestation: templateId ${templateId} does not match ` +
        `the canonical KYC template ${nexaidConfig.kycTemplate.templateId}.`
    );
  }

  const onChainCheck = await confirmReportOnChain(reportTxHash);
  if (!onChainCheck.exists || !onChainCheck.confirmed) {
    throw new Error(
      `Refusing to issue attestation: reportTxHash ${reportTxHash} is not a ` +
        `confirmed transaction on ${activeChain.name}.`
    );
  }

  const taskResult = await fetchNexaidTaskResult(taskId);

  const PASSING_KYC_STATUSES = ["PASS", "VERIFIED", "PASSED", "SUCCESS", "COMPLETED"];

  if (!PASSING_KYC_STATUSES.includes(taskResult.kycStatus.toUpperCase())) {
    throw new Error(
      `Refusing to issue attestation: NexaID task ${taskId} kycStatus is ` +
        `"${taskResult.kycStatus}" which is not in the accepted passing statuses ` +
        `[${PASSING_KYC_STATUSES.join(", ")}]. If this is a valid passing status, ` +
        `add it to PASSING_KYC_STATUSES in nexaidVerifier.ts.`
    );
  }

  return {
    subject,
    kycLevel: taskResult.passKycLevel,
    reportTxHash,
    taskId,
    verifiedAt: Math.floor(Date.now() / 1000),
  };
}
