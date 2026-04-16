# Proof Generation (In-Browser)

Nexash generates UltraHonk ZK proofs entirely in the user's browser using WebAssembly. No private data is sent to any server.

---

## Stack

| Component | Version | Purpose |
|---|---|---|
| `@aztec/bb.js` | Latest | Barretenberg WebAssembly (UltraHonk prover/verifier) |
| `@noir-lang/noir_js` | Latest | Noir circuit execution |
| `@noir-lang/backend_barretenberg` | Latest | Barretenberg backend for Noir |

---

## Initialization

Before generating any proof, the Barretenberg backend must be initialized. This involves loading the WASM binary (~20MB) and initializing the proving key for each circuit.

```typescript
// lib/zk/barretenberg.ts

export async function initBarretenberg(onStep?: (msg: string) => void) {
  onStep?.('Loading ZK backend...')
  
  // Load identity circuit
  const idCircuit = await fetch('/circuits/identity_compliance.json').then(r => r.json())
  const idBackend = new UltraHonkBackend(idCircuit.bytecode)
  const idNoir    = new Noir(idCircuit)
  
  // Load policy circuit
  const polCircuit = await fetch('/circuits/transaction_policy.json').then(r => r.json())
  const polBackend = new UltraHonkBackend(polCircuit.bytecode)
  const polNoir    = new Noir(polCircuit)

  onStep?.('ZK backend ready')
}
```

The circuit JSON files are served from `/public/circuits/` in the Next.js frontend. They contain the compiled Noir bytecode and circuit metadata.

---

## Identity Proof Generation

```typescript
// lib/zk/identity.ts

export async function generateIdentityProof(
  inputs: IdentityProofInputs
): Promise<{ proof: Uint8Array; publicInputs: string[] }> {
  const noir    = getIdNoir()
  const backend = getIdBackend()
  
  // Execute the circuit to get the witness
  const { witness } = await noir.execute(inputs)
  
  // Generate UltraHonk proof from witness
  const { proof, publicInputs } = await backend.generateProof(witness, {
    verifierTarget: 'evm',  // Generates proof compatible with Solidity verifier
  })
  
  // Local verification (optional, catches errors before on-chain submission)
  const verified = await backend.verifyProof({ proof, publicInputs }, {
    verifierTarget: 'evm',
  })
  
  if (!verified) throw new Error('Identity proof failed local verification')
  
  return { proof, publicInputs }
}
```

---

## Input Preparation

Before proof generation, raw values must be converted to the BN254 field format expected by Noir.

### Field Modulus Reduction

256-bit values (like Ethereum transaction hashes) must be reduced modulo the BN254 field modulus before being passed to the circuit:

```typescript
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n

const toBigInt = (val: string): bigint => {
  if (!val || val === '0x' + '0'.repeat(64)) return 0n
  return val.startsWith('0x') ? BigInt(val) : BigInt('0x' + val)
}

const reportTxHashField = (toBigInt(reportTxHash) % FIELD_MODULUS).toString()
```

### Pedersen Hash (In-Browser)

KYC data commitments and nullifiers are computed using Barretenberg's Pedersen hash implementation:

```typescript
export async function pedersenHash(inputs: bigint[]): Promise<string> {
  const bb = await getBarretenberg()
  const fields = inputs.map(i => i.toString(16).padStart(64, '0'))
  const result = await bb.pedersenHash(fields)
  return '0x' + result
}
```

---

## Proof Size and Gas

| Proof | Size | Verification Gas |
|---|---|---|
| Identity proof | ~2KB | ~300,000 gas |
| Policy proof | ~2KB | ~300,000 gas |
| Both (single tx) | ~4KB calldata | ~700,000 gas |

---

## Performance

Proof generation time depends on device hardware:

| Device | Identity proof | Policy proof |
|---|---|---|
| Modern laptop (M2/Ryzen 7) | ~35s | ~35s |
| Mid-range laptop | ~50s | ~50s |
| Low-end device | ~90s | ~90s |

Both proofs run sequentially (identity first, then policy). Total time for a payment is approximately 70-180 seconds depending on device.

### Future Optimizations

- **SIMD WASM** — Barretenberg supports SIMD instructions in newer WASM builds, potentially halving proof time
- **Parallel proving** — Run identity and policy proofs in parallel using Web Workers
- **Proof caching** — Cache the identity proof and reuse for subsequent payments to the same treasury

---

## Error Handling

Common proof generation errors:

| Error | Cause | Fix |
|---|---|---|
| `Value exceeds field modulus` | Raw hash not reduced mod BN254 | Apply `% FIELD_MODULUS` before passing |
| `Circuit execution failed` | A constraint is not satisfied | Check input values against circuit constraints |
| `WASM out of memory` | Device has insufficient RAM | Increase browser tab memory limit |
| `Backend not initialized` | `initBarretenberg()` not called | Ensure initialization completes before proving |
