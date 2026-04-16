export const CONTRACTS = {
  ZK_TREASURY:       process.env.NEXT_PUBLIC_ZK_TREASURY       as `0x${string}`,
  TREASURY_FACTORY:  process.env.NEXT_PUBLIC_TREASURY_FACTORY   as `0x${string}`,
  POLICY_ENGINE:     process.env.NEXT_PUBLIC_POLICY_ENGINE      as `0x${string}`,
  KYC_GATE:          process.env.NEXT_PUBLIC_KYC_GATE           as `0x${string}`,
  HSP_ADAPTER:       process.env.NEXT_PUBLIC_HSP_ADAPTER        as `0x${string}`,
  IDENTITY_VERIFIER: process.env.NEXT_PUBLIC_IDENTITY_VERIFIER  as `0x${string}`,
  POLICY_VERIFIER:   process.env.NEXT_PUBLIC_POLICY_VERIFIER    as `0x${string}`,
  MOCK_KYC_SBT:      process.env.NEXT_PUBLIC_MOCK_KYC_SBT       as `0x${string}`,
} as const

export const TOKENS = {
  USDC_E: process.env.NEXT_PUBLIC_USDC_E as `0x${string}`,
  USDC:   process.env.NEXT_PUBLIC_USDC   as `0x${string}`,
  USDT:   process.env.NEXT_PUBLIC_USDT   as `0x${string}`,
} as const

export const TOKEN_SYMBOLS: Record<string, string> = {
  [process.env.NEXT_PUBLIC_USDC_E!.toLowerCase()]: 'USDC.e',
  [process.env.NEXT_PUBLIC_USDC!.toLowerCase()]:   'USDC',
  [process.env.NEXT_PUBLIC_USDT!.toLowerCase()]:   'USDT',
}

export const CHAIN_ID  = Number(process.env.NEXT_PUBLIC_CHAIN_ID)
export const RPC_URL   = process.env.NEXT_PUBLIC_RPC_URL!
export const EXPLORER  = process.env.NEXT_PUBLIC_EXPLORER_URL!
