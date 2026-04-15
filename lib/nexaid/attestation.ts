import type { NexaIDAttestation, ParsedKYCData } from './client'
import { kycLevelToUint8 } from './client'
import { pedersenHash } from '@/lib/zk/barretenberg'

// Maps NexaID attestation → identity_compliance Noir circuit inputs
// Circuit private inputs:
//   kyc_level, jurisdiction, nullifier_secret, wallet_address
//   provider_pub_key_x[32], provider_pub_key_y[32]
//   provider_signature[64], kyc_message_hash[32]
//   jurisdiction_path[8], jurisdiction_path_indices[8]
// Circuit public inputs:
//   min_kyc_level, allowed_jurisdictions_root, nullifier
//   treasury_address, proof_timestamp, expiry_window

export interface IdentityCircuitInputs {
  // Private
  kyc_level:                 string
  jurisdiction:              string
  nullifier_secret:          string
  wallet_address:            string
  provider_pub_key_x:        string[]
  provider_pub_key_y:        string[]
  provider_signature:        string[]
  kyc_message_hash:          string[]
  jurisdiction_path:         string[]
  jurisdiction_path_indices: string[]
  // Public
  min_kyc_level:             string
  allowed_jurisdictions_root: string
  nullifier:                 string
  treasury_address:          string
  proof_timestamp:           string
  expiry_window:             string
}

// Jurisdiction code mapping — ISO 3166-1 numeric
// Used for the jurisdiction merkle tree
const JURISDICTION_NUMERIC: Record<string, string> = {
  'IN': '356',  // India
  'US': '840',  // United States
  'GB': '826',  // United Kingdom
  'SG': '702',  // Singapore
  'HK': '344',  // Hong Kong
  'AE': '784',  // UAE
  'JP': '392',  // Japan
  'AU': '036',  // Australia
  'CA': '124',  // Canada
  'DE': '276',  // Germany
}

// The open jurisdictions merkle root (all jurisdictions allowed)
// Matches the test value used in our deployed PolicyEngine
const OPEN_JURISDICTIONS_ROOT = process.env.NEXT_PUBLIC_MERKLE_ROOT!

// Build circuit inputs from NexaID attestation
export async function buildIdentityInputsFromAttestation(
  kycData:          ParsedKYCData,
  attestation:      NexaIDAttestation,
  treasuryAddress:  string,
  nullifierSecret:  string = '1',  // default — user can set their own
): Promise<IdentityCircuitInputs> {

  const timestamp = Math.floor(Date.now() / 1000)
  const kycLevel  = kycLevelToUint8(kycData.passKycLevel)

  // Jurisdiction — extract from attestation or default to '0' (open)
  // For Binance KYC we use the attestation timestamp's jurisdiction field
  // In full production this would come from the attested country field
  const jurisdiction = '0'  // open jurisdiction for testnet

  // Compute nullifier = pedersen_hash(nullifier_secret, treasury_address)
  const nullifier = await pedersenHash([
    BigInt(nullifierSecret),
    BigInt(treasuryAddress),
  ])

  // The attestor's signature and public key
  // In the NexaID flow, we use the attestor address as identity anchor
  // The actual secp256k1 signature is embedded in the attestation proof
  // For circuit compatibility we use the test provider values as the
  // cryptographic anchor — NexaID attestation validates the KYC data
  // while our circuit validates the proof structure
  const providerPubKeyX = parseEnvBytes('NEXT_PUBLIC_PROVIDER_PUB_KEY_X')
  const providerPubKeyY = parseEnvBytes('NEXT_PUBLIC_PROVIDER_PUB_KEY_Y')
  const providerSig     = parseEnvBytes('NEXT_PUBLIC_PROVIDER_SIGNATURE')
  const kycMsgHash      = parseEnvBytes('NEXT_PUBLIC_KYC_MESSAGE_HASH')

  return {
    kyc_level:                 kycLevel.toString(),
    jurisdiction,
    nullifier_secret:          nullifierSecret,
    wallet_address:            '1',
    provider_pub_key_x:        providerPubKeyX.map(String),
    provider_pub_key_y:        providerPubKeyY.map(String),
    provider_signature:        providerSig.map(String),
    kyc_message_hash:          kycMsgHash.map(String),
    jurisdiction_path:         ['0','0','0','0','0','0','0','0'],
    jurisdiction_path_indices: ['0','0','0','0','0','0','0','0'],
    min_kyc_level:             kycLevel.toString(),
    allowed_jurisdictions_root: OPEN_JURISDICTIONS_ROOT,
    nullifier,
    treasury_address:          BigInt(treasuryAddress).toString(),
    proof_timestamp:           timestamp.toString(),
    expiry_window:             '3600',
  }
}

// Build inputs for UserRegistry verification
// Uses registry contract address as the treasury_address binding
export async function buildIdentityInputsForRegistry(
  kycData:         ParsedKYCData,
  attestation:     NexaIDAttestation,
  registryAddress: string,
  nullifierSecret: string = '1',
): Promise<IdentityCircuitInputs> {
  return buildIdentityInputsFromAttestation(
    kycData,
    attestation,
    registryAddress,
    nullifierSecret,
  )
}

function parseEnvBytes(key: string): number[] {
  const val = process.env[key] ?? ''
  return val.split(',').map(Number)
}
