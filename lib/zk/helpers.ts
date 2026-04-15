import { Barretenberg } from '@aztec/bb.js'

// Singleton Barretenberg instance — initialize once, reuse across proofs
let _api: Barretenberg | null = null

export async function getBarretenberg(): Promise<Barretenberg> {
  if (!_api) {
    _api = await Barretenberg.new({ threads: 4 })
  }
  return _api
}

// Convert a BigInt to a 32-byte Uint8Array (big-endian)
export function toField(v: bigint): Uint8Array {
  const buf = new Uint8Array(32)
  let val = v
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(val & 0xffn)
    val >>= 8n
  }
  return buf
}

// Compute pedersen_hash([nullifier_secret, treasury_address])
// Must match the identity_compliance Noir circuit exactly
export async function computeNullifier(
  nullifierSecret: string,
  treasuryAddress: string
): Promise<string> {
  const api = await getBarretenberg()
  const result = await api.pedersenHash({
    inputs: [
      toField(BigInt(nullifierSecret)),
      toField(BigInt(treasuryAddress)),
    ],
    hashIndex: 0,
  })
  return '0x' + Buffer.from(result.hash).toString('hex')
}

// Compute pedersen_hash([spending_limit, daily_limit, threshold, min_role, treasury])
// Must match the transaction_policy Noir circuit exactly
export async function computePolicyHash(
  spendingLimit: bigint,
  dailySpendLimit: bigint,
  multisigThreshold: bigint,
  minRole: bigint,
  treasuryAddress: string
): Promise<string> {
  const api = await getBarretenberg()
  const result = await api.pedersenHash({
    inputs: [
      toField(spendingLimit),
      toField(dailySpendLimit),
      toField(multisigThreshold),
      toField(minRole),
      toField(BigInt(treasuryAddress)),
    ],
    hashIndex: 0,
  })
  return '0x' + Buffer.from(result.hash).toString('hex')
}

// Generate a unique bytes32 payment request ID
export function generatePaymentRequestId(): `0x${string}` {
  const timestamp = Math.floor(Date.now() / 1000)
  const random = Math.floor(Math.random() * 0xffffff)
  const hex = `nexash-${timestamp}-${random}`
  const encoded = Buffer.from(hex).toString('hex').padStart(62, '0').slice(0, 62)
  return `0x${encoded.padStart(64, '0')}` as `0x${string}`
}

// Format a bytes32 value as hex string
export function toHex32(n: bigint): `0x${string}` {
  return `0x${n.toString(16).padStart(64, '0')}` as `0x${string}`
}

// Parse comma-separated env var into number array
export function parseEnvBytes(envVar: string): number[] {
  return envVar.split(',').map(Number)
}
