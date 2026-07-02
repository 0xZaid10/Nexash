import { env } from "./env";

/**
 * NexaID mainnet configuration, as confirmed directly from the published
 * @nexaid/network-js-sdk@1.1.0 bundle (dist/index-*.mjs, the `ud` config
 * object) on 2026-06-26. See hackathon_refs/nexaid/_unverified_sdk_analysis/
 * mainnet_support_claim.md for the full verification trail (SDK internals +
 * Blockscout + live API, all independently confirmed).
 */
export const NEXAID_MAINNET_CONFIG = {
  chainId: 177,
  chainName: "HashKey Chain Mainnet",
  apiUrl: env.NEXAID_API_BASE_URL,
  taskContractAddress: "0x1c5D0d5e0a3e0a5c9B0cDcF5C25A892281e4cd04",
  nodeContractAddress: "0x3CF341692deAD89AD0e98141B768eF3Ad89CDCa7",
} as const;

/**
 * The CANONICAL KYC Status (Binance) template, confirmed live on the NexaID
 * mainnet DevHub marketplace on 2026-06-26. A prior, different template ID
 * (716efc19-807e-4c6a-a2fe-674cd634a938) referenced in V1 Nexash is
 * SUPERSEDED and must never be used by V2 - see
 * hackathon_refs/nexaid/marketplace_templates/templates_catalog.md.
 */
export const NEXAID_KYC_TEMPLATE = {
  templateId: env.NEXAID_KYC_TEMPLATE_ID,
  dataSourceUrl: "https://www.binance.com/en/my/settings/kyc",
  requestUrl: "https://www.binance.com/bapi/kyc/v2/private/certificate/user-kyc/current-kyc-status",
  dataItems: {
    kycStatus: "$.data.kycStatus",
    userId: "$.data.userId",
    passKycLevel: "$.data.passKycLevel",
  },
} as const;

export const nexaidConfig = {
  mainnet: NEXAID_MAINNET_CONFIG,
  kycTemplate: NEXAID_KYC_TEMPLATE,
} as const;
