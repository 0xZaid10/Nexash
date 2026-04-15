'use client'

// NexaID Network JS SDK integration
// Template: 716efc19-807e-4c6a-a2fe-674cd634a938 (KYC Status - Binance)
// Chain: 133 (HashKey Chain Testnet)

export interface NexaIDAttestation {
  attestor:        string
  taskId:          string
  reportTxHash:    string   // on-chain tx hash — trustless attestation anchor
  signature:       string   // attestor signature
  attestorUrl:     string
  attestationTime: number
  attestation: {
    recipient:       string
    request:         Array<{ url: string; method: string; body: string }>
    responseResolve: Array<{
      oneUrlResponseResolve: Array<{
        keyName:   string
        parsePath: string
      }>
    }>
    data:            string  // stringified JSON of verified fields
    attConditions:   string | unknown
    timestamp:       number
    additionParams:  string
  }
}

export interface ParsedKYCData {
  kycStatus:    string   // "1" = verified
  passKycLevel: string   // "INTERMEDIATE", "ADVANCED", etc.
  userId:       string   // SHA256 hashed
  timestamp:    number
  attestor:     string
  taskId:       string
}

export type KYCLevel = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'PREMIUM'

export const KYC_LEVEL_TO_UINT: Record<string, number> = {
  'BASIC':        1,
  'INTERMEDIATE': 2,
  'ADVANCED':     3,
  'PREMIUM':      4,
  'ULTIMATE':     5,
}

const TEMPLATE_ID = process.env.NEXT_PUBLIC_NEXAID_TEMPLATE_ID!
const CHAIN_ID    = 133

// Check if NexaID extension is installed
export function isNexaIDInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as Record<string, unknown>).NexaIDNetwork ||
         !!(window as unknown as Record<string, unknown>).nexaid
}

// Run full NexaID attestation flow
export async function runNexaIDAttestation(
  walletAddress: string,
  provider: unknown,
  onStep?: (step: string) => void
): Promise<NexaIDAttestation> {
  const { NexaIDNetwork } = await import('@nexaid/network-js-sdk')

  const nexaIDNetwork = new NexaIDNetwork()

  onStep?.('Connecting to NexaID network...')

  // Ensure wallet is on HashKey Chain Testnet (133 = 0x85)
  // NexaID SDK uses ethers internally and needs the correct chain
  try {
    const rawProvider = provider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
    const currentChain = await rawProvider.request({ method: 'eth_chainId' })
    if (currentChain !== '0x85') {
      try {
        await rawProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x85' }],
        })
      } catch {
        // Chain not added yet — add it
        await rawProvider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId:          '0x85',
            chainName:        'HashKey Chain Testnet',
            nativeCurrency:   { name: 'HSK', symbol: 'HSK', decimals: 18 },
            rpcUrls:          ['https://testnet.hsk.xyz'],
            blockExplorerUrls: ['https://testnet-explorer.hsk.xyz'],
          }],
        })
      }
    }
  } catch (e) {
    console.warn('Chain switch warning:', e)
  }

  await nexaIDNetwork.init(provider, CHAIN_ID)

  onStep?.('Submitting attestation task...')
  const submitTaskResult = await nexaIDNetwork.submitTask({
    templateId: TEMPLATE_ID,
    address:    walletAddress,
  })

  onStep?.('Running zkTLS verification with Binance KYC...')
  const attestResults = await (nexaIDNetwork.attest as Function)({
    templateId:    TEMPLATE_ID,
    address:       walletAddress,
    taskId:        submitTaskResult.taskId,
    taskTxHash:    submitTaskResult.taskTxHash,
    taskAttestors: submitTaskResult.taskAttestors,
    // Privacy-preserving conditions:
    // kycStatus = 1 (just proves verified, no reveal)
    // passKycLevel = INTERMEDIATE (proves minimum level, no reveal)
    // userId SHA256 (hashed, never revealed)
    attConditions: ([[
      { field: 'kycStatus',    op: '=' as const,      value: '1'            },
      { field: 'passKycLevel', op: '=' as const,      value: 'INTERMEDIATE' },
      { field: 'userId',       op: 'SHA256' as const                        },
    ]] as unknown) as never,
  })

  onStep?.('Verifying on-chain...')
  await nexaIDNetwork.verifyAndPollTaskResult({
    taskId:        attestResults[0].taskId,
    reportTxHash:  attestResults[0].reportTxHash,
    timeoutMs:     120_000,
    intervalMs:    3_000,
  })

  return attestResults[0] as NexaIDAttestation
}

// Parse attestation data fields
export function parseAttestationData(attestation: NexaIDAttestation): ParsedKYCData {
  let data: Record<string, string> = {}
  try {
    data = JSON.parse(attestation.attestation.data)
  } catch {
    throw new Error('Failed to parse attestation data')
  }

  return {
    kycStatus:    data.kycStatus    ?? '0',
    passKycLevel: data.passKycLevel ?? 'BASIC',
    userId:       data.userId       ?? '',
    timestamp:    attestation.attestation.timestamp,
    attestor:     attestation.attestor,
    taskId:       attestation.taskId,
  }
}

// Convert passKycLevel string to uint8 for Noir circuit
export function kycLevelToUint8(level: string): number {
  return KYC_LEVEL_TO_UINT[level.toUpperCase()] ?? 1
}

// Extract attestor address components for circuit
// The attestor address is derived from their secp256k1 public key
export function getAttestorAddress(attestation: NexaIDAttestation): string {
  return attestation.attestor
}
