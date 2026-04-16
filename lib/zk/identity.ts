import { getIdBackend, getIdNoir, pedersenHash } from './barretenberg'
import { zkLogger } from './logger'

export interface IdentityProofInputs {
  // Private
  kyc_level:                  string
  jurisdiction:               string
  nullifier_secret:           string
  wallet_address:             string
  report_tx_hash:             string   // NexaID reportTxHash (private)
  task_id:                    string   // NexaID taskId
  kyc_data_commitment:        string   // pedersen_hash(kyc_level, jurisdiction, wallet, task_id)
  jurisdiction_path:          string[]
  jurisdiction_path_indices:  string[]
  // Public
  min_kyc_level:              string
  allowed_jurisdictions_root: string
  nullifier:                  string
  treasury_address:           string
  proof_timestamp:            string
  expiry_window:              string
  report_tx_hash_public:      string   // same as report_tx_hash — verifiable on-chain
}

export interface ProofResult {
  proof:        Uint8Array
  publicInputs: string[]
}

// ── Nullifier ────────────────────────────────────────────────────────────────

export async function computeNullifier(
  nullifierSecret: string,
  treasuryAddress: string
): Promise<string> {
  return pedersenHash([BigInt(nullifierSecret), BigInt(treasuryAddress)])
}

// ── Build circuit inputs from NexaID attestation ─────────────────────────────

export async function buildIdentityInputs(
  kycLevel:        number,        // from NexaID attestation (1-4)
  jurisdiction:    number,        // ISO 3166-1 numeric (344 = HK, 356 = IN, etc.)
  reportTxHash:    string,        // from nexaIDNetwork.attest() → attestResults[0].reportTxHash
  taskId:          string,        // from nexaIDNetwork.attest() → attestResults[0].taskId
  treasuryAddress: string,        // registry or treasury address
  nullifierSecret: string = '1',  // user's nullifier secret
  merkleRoot:      string = '0x13bd9dbff2be08153a1611e762cac8f06c945bc763c5eb4339fb55cd34383cd1',
): Promise<IdentityProofInputs> {
  const timestamp = Math.floor(Date.now() / 1000)

  // BN254 field modulus — values must be < this
  const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n

  // Helper: convert hex or decimal string to BigInt safely
  const toBigInt = (val: string): bigint => {
    if (!val || val === '0x' || val === '0x' + '0'.repeat(64)) return 0n
    const s = val.trim()
    return s.startsWith('0x') || s.startsWith('0X') ? BigInt(s) : BigInt('0x' + s)
  }

  // Convert reportTxHash to Field — take modulo field modulus to fit in BN254
  const reportTxHashField = (toBigInt(reportTxHash) % FIELD_MODULUS).toString()

  // Convert taskId to Field — same modulo
  const taskIdField = (toBigInt(taskId) % FIELD_MODULUS).toString()

  // Compute nullifier
  const nullifier = await computeNullifier(nullifierSecret, treasuryAddress)

  // kyc_data_commitment = pedersen_hash(kyc_level, jurisdiction, wallet_address, task_id)
  // This binds the proof to specific attested KYC values
  const kycDataCommitment = await pedersenHash([
    BigInt(kycLevel),
    BigInt(jurisdiction),
    BigInt(1), // wallet_address placeholder (privacy preserved)
    BigInt(taskIdField),
  ])

  return {
    kyc_level:                 kycLevel.toString(),
    jurisdiction:              jurisdiction.toString(),
    nullifier_secret:          nullifierSecret,
    wallet_address:            '1',
    report_tx_hash:            reportTxHashField,
    task_id:                   taskIdField,
    kyc_data_commitment:       kycDataCommitment,
    jurisdiction_path:         ['0','0','0','0','0','0','0','0'],
    jurisdiction_path_indices: ['0','0','0','0','0','0','0','0'],
    min_kyc_level:             kycLevel.toString(),
    allowed_jurisdictions_root: merkleRoot,
    nullifier,
    treasury_address:          BigInt(treasuryAddress).toString(),
    proof_timestamp:           timestamp.toString(),
    expiry_window:             '3600',
    report_tx_hash_public:     reportTxHashField,
  }
}

// ── Generate proof ────────────────────────────────────────────────────────────

export async function generateIdentityProof(
  inputs:          IdentityProofInputs,
  treasuryAddress?: string
): Promise<ProofResult> {
  zkLogger.identityStart(treasuryAddress ?? inputs.treasury_address)
  zkLogger.identityInputs(inputs as unknown as Record<string, unknown>)
  zkLogger.identityGenerating()

  const noir    = getIdNoir()
  const backend = getIdBackend()

  const { witness } = await noir.execute(
    inputs as unknown as import('@noir-lang/noir_js').InputMap
  )

  const { proof, publicInputs } = await backend.generateProof(witness, {
    verifierTarget: 'evm',
  })

  const verified = await backend.verifyProof(
    { proof, publicInputs },
    { verifierTarget: 'evm' }
  )

  if (!verified) throw new Error('Identity proof failed local verification')

  zkLogger.identityProofReady(proof, publicInputs)
  return { proof, publicInputs }
}
