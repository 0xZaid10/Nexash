import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js'
import { Noir } from '@noir-lang/noir_js'

// ── Singleton instances ───────────────────────────────────────────
let _api: Barretenberg | null = null
let _idBackend:  UltraHonkBackend | null = null
let _polBackend: UltraHonkBackend | null = null
let _idNoir:     Noir | null = null
let _polNoir:    Noir | null = null
let _initialized = false

// ── Circuit loading ───────────────────────────────────────────────
async function loadCircuit(name: string) {
  const res = await fetch(`/circuits/${name}.json`)
  if (!res.ok) throw new Error(`Failed to load circuit: ${name}`)
  return res.json()
}

// ── Initialize all ZK infrastructure ─────────────────────────────
// Call once before any proof generation.
// Subsequent calls are no-ops.
export async function initBarretenberg(
  onProgress?: (msg: string) => void
): Promise<void> {
  if (_initialized) return

  onProgress?.('Initializing cryptographic backend...')
  _api = await Barretenberg.new({ threads: 4 })

  onProgress?.('Loading identity circuit...')
  const idCircuit  = await loadCircuit('identity_compliance')

  onProgress?.('Loading policy circuit...')
  const polCircuit = await loadCircuit('transaction_policy')

  onProgress?.('Preparing proof backends...')
  _idBackend  = new UltraHonkBackend(idCircuit.bytecode, _api)
  _polBackend = new UltraHonkBackend(polCircuit.bytecode, _api)
  _idNoir     = new Noir(idCircuit)
  _polNoir    = new Noir(polCircuit)

  _initialized = true
  onProgress?.('ZK backend ready')
}

export function getIdBackend():  UltraHonkBackend { if (!_idBackend)  throw new Error('Barretenberg not initialized'); return _idBackend }
export function getPolBackend(): UltraHonkBackend { if (!_polBackend) throw new Error('Barretenberg not initialized'); return _polBackend }
export function getIdNoir():     Noir             { if (!_idNoir)     throw new Error('Barretenberg not initialized'); return _idNoir }
export function getPolNoir():    Noir             { if (!_polNoir)    throw new Error('Barretenberg not initialized'); return _polNoir }
export function getApi():        Barretenberg     { if (!_api)        throw new Error('Barretenberg not initialized'); return _api }
export function isInitialized(): boolean          { return _initialized }

// Compute pedersen hash using the initialized API
export async function pedersenHash(inputs: bigint[]): Promise<string> {
  const api = getApi()

  function toField(v: bigint): Uint8Array {
    const buf = new Uint8Array(32)
    let val = v
    for (let i = 31; i >= 0; i--) {
      buf[i] = Number(val & 0xffn)
      val >>= 8n
    }
    return buf
  }

  const result = await api.pedersenHash({
    inputs: inputs.map(toField),
    hashIndex: 0,
  })
  return '0x' + Buffer.from(result.hash).toString('hex')
}
