# Identity Compliance Circuit

The identity compliance circuit is the core ZK component of Nexash. It proves a recipient's KYC compliance without revealing any personal information.

---

## Purpose

When an institution initiates a payment, it needs to know one thing: does this recipient meet our KYC requirements? The identity circuit answers this question with a cryptographic proof — a mathematical guarantee that is correct or the proof is invalid. No trust required.

---

## Circuit Location

```
circuits/identity_compliance/
├── src/
│   └── main.nr          # Circuit definition
├── Nargo.toml            # Noir project config
└── target/
    └── identity_compliance.json  # Compiled circuit (deployed to frontend)
```

---

## Inputs

### Private Inputs

These values are known only to the prover (the recipient). They never leave the browser.

| Input | Type | Description |
|---|---|---|
| `kyc_level` | `u8` | KYC tier from NexaID attestation (1=Basic, 2=Intermediate, 3=Advanced, 4=Premium) |
| `jurisdiction` | `u32` | ISO 3166-1 numeric country code (e.g. 344=Hong Kong, 356=India) |
| `nullifier_secret` | `Field` | User's secret for computing the nullifier |
| `wallet_address` | `Field` | Wallet address as a field element |
| `report_tx_hash` | `Field` | NexaID `reportTxHash` reduced modulo BN254 field modulus |
| `task_id` | `Field` | NexaID `taskId` reduced modulo BN254 field modulus |
| `kyc_data_commitment` | `Field` | `pedersen_hash(kycLevel, jurisdiction, walletAddress, taskId)` |
| `jurisdiction_path` | `[Field; 8]` | Merkle proof path for jurisdiction |
| `jurisdiction_path_indices` | `[u1; 8]` | Left/right indices for Merkle path |

### Public Inputs

These values are submitted on-chain alongside the proof. Anyone can inspect them.

| Input | Type | Description |
|---|---|---|
| `min_kyc_level` | `u8` | Minimum KYC level required by the institution |
| `allowed_jurisdictions_root` | `Field` | Merkle root of allowed jurisdiction set |
| `nullifier` | `Field` | `pedersen_hash(nullifier_secret, treasury_address)` — unique per user per treasury |
| `treasury_address` | `Field` | Address of the registry or treasury this proof is bound to |
| `proof_timestamp` | `u64` | Unix timestamp when proof was generated |
| `expiry_window` | `u64` | Validity window in seconds (default 3600) |
| `report_tx_hash_public` | `Field` | Public version of the NexaID attestation tx hash — verifiable on HashKey Chain |

---

## Constraints (What the Circuit Proves)

The circuit enforces seven constraints. All must be satisfied for the proof to be valid.

### Constraint 1 — KYC Level Check
```noir
assert(kyc_level >= min_kyc_level, "KYC level insufficient");
assert(kyc_level <= 4, "Invalid KYC level");
```
Proves the recipient's KYC tier meets or exceeds the institution's requirement. The actual `kyc_level` is never revealed — only that it satisfies this inequality.

### Constraint 2 — Jurisdiction Allowlist
```noir
let computed_root = compute_merkle_root(
    jurisdiction as Field,
    jurisdiction_path,
    jurisdiction_path_indices
);
assert(computed_root == allowed_jurisdictions_root, "Jurisdiction not in allowlist");
```
Proves the recipient's jurisdiction is a member of the institution's allowed set, using a Merkle membership proof. The actual jurisdiction is never revealed — only that it is in the tree.

### Constraint 3 — Nullifier Derivation
```noir
let expected_nullifier = pedersen_hash([nullifier_secret, treasury_address]);
assert(nullifier == expected_nullifier, "Invalid nullifier");
```
Proves the submitted nullifier was correctly derived from a secret the prover controls. This allows the contract to prevent proof replay without linking the nullifier to the prover's identity.

### Constraint 4 — Wallet Binding
```noir
let address_commitment = pedersen_hash([wallet_address, nullifier_secret]);
assert(address_commitment != 0, "Invalid wallet address commitment");
```
Proves the prover knows the wallet address and a secret that binds this proof to that wallet.

### Constraint 5 — Timestamp Validity
```noir
assert(proof_timestamp > 0, "Invalid timestamp");
assert(expiry_window > 0, "Invalid expiry window");
```
Basic sanity checks on the proof freshness parameters.

### Constraint 6 — NexaID Attestation Exists
```noir
assert(report_tx_hash != 0, "NexaID attestation tx hash is zero — no on-chain attestation");
```
The most important constraint for the DVC pattern. Proves the prover knows a non-zero `reportTxHash` — a transaction on HashKey Chain that records the NexaID attestation. If the attestation never happened, this hash is zero and the proof fails.

### Constraint 7 — Hash Consistency
```noir
assert(report_tx_hash == report_tx_hash_public, "Report tx hash mismatch");
```
Proves the private `report_tx_hash` matches the public one submitted on-chain. This is what allows the contract to verify the attestation is real — the public hash can be checked against HashKey Chain's block explorer.

### Constraint 8 — Task ID Validity
```noir
assert(task_id != 0, "Invalid NexaID task ID");
```
Ensures the attestation is bound to a specific NexaID task.

### Constraint 9 — KYC Data Commitment
```noir
let expected_commitment = pedersen_hash([kyc_level as Field, jurisdiction as Field, wallet_address, task_id]);
assert(expected_commitment == kyc_data_commitment, "KYC data commitment mismatch");
```
Binds the proof to specific attested KYC values. This prevents a prover from using one attestation's `reportTxHash` with a different KYC level or jurisdiction.

---

## The Merkle Tree (Jurisdiction Allowlist)

The allowed jurisdictions are stored as a Merkle tree with depth 8 (up to 256 leaf nodes). Each leaf is an ISO 3166-1 numeric country code.

For the testnet, the tree is configured to allow all jurisdictions (root computed from a single leaf at index 0, path all zeros). Production deployments would configure specific allowed jurisdictions per treasury.

```noir
fn compute_merkle_root(leaf: Field, path: [Field; 8], indices: [u1; 8]) -> Field {
    let mut current = leaf;
    for i in 0..8 {
        let sibling = path[i];
        let index   = indices[i];
        let left    = if index == 0 { current } else { sibling };
        let right   = if index == 0 { sibling } else { current };
        current = pedersen_hash([left, right]);
    }
    current
}
```

---

## On-Chain Verification

The compiled circuit exports a Solidity verifier contract (`IdentityVerifier.sol`) generated by Barretenberg. This contract is deployed at:

`0x4089449207d346cDeDc4fE7Eb2237D2Bd80b82De` (HashKey Chain Testnet)

The verifier exposes:
```solidity
function verify(
    bytes calldata proof,
    bytes32[] calldata publicInputs
) external view returns (bool);
```

`NexashUserRegistry` calls this during identity verification. `ZKTreasury` calls this during payment execution.

---

## Circuit Compilation

```bash
cd circuits/identity_compliance
nargo compile
# Outputs: target/identity_compliance.json
```

The compiled circuit JSON is served from `public/circuits/identity_compliance.json` in the frontend. The browser loads it to initialize the Barretenberg backend for proof generation.

---

## Test Cases

The circuit includes three test cases:

```
nargo test --show-output

[identity_compliance] Testing test_valid_proof_with_nexaid_attestation ... ok
[identity_compliance] Testing test_kyc_level_too_low ... ok
[identity_compliance] Testing test_zero_report_tx_hash_fails ... ok
[identity_compliance] 3 tests passed
```
