# Transaction Policy Circuit

The transaction policy circuit proves that a payment complies with a treasury's configured spending policy, without revealing the treasury's full transaction history.

---

## Purpose

Every treasury has a spending policy: a maximum per-transaction amount, a daily spending limit, a minimum operator role, and a multisig threshold. When a payment is initiated, the policy circuit proves the payment satisfies all these constraints — and that the proof is bound to the specific policy hash stored on-chain.

---

## Inputs

### Private Inputs

| Input | Type | Description |
|---|---|---|
| `amount` | `u64` | Payment amount in token base units (e.g. 1000000 = 1 USDC.e) |
| `daily_spent` | `u64` | Amount already spent today across all operators |
| `operator_role` | `u8` | Role of the payment initiator (1=Viewer, 2=Operator, 3=Admin) |
| `nullifier_secret` | `Field` | Secret for deriving the payment nullifier |

### Public Inputs

| Input | Type | Description |
|---|---|---|
| `spending_limit` | `Field` | Per-transaction maximum |
| `daily_spend_limit` | `Field` | Daily maximum across all operators |
| `multisig_threshold` | `Field` | Required number of approvals |
| `min_operator_role` | `Field` | Minimum role allowed to initiate payments |
| `allowed_jurisdictions_root` | `Field` | Merkle root (must match identity proof) |
| `policy_hash` | `Field` | Pedersen hash of the complete policy — binds proof to specific policy |
| `payment_req_id` | `Field` | Unique payment request identifier — prevents replay |
| `timestamp` | `Field` | Proof generation timestamp |
| `treasury_address` | `Field` | Treasury this proof is bound to |

---

## Constraints

### Constraint 1 — Amount Within Limit
```noir
assert(amount <= spending_limit as u64, "Amount exceeds spending limit");
```
Proves the payment does not exceed the per-transaction cap.

### Constraint 2 — Daily Limit
```noir
assert(daily_spent + amount <= daily_spend_limit as u64, "Daily limit exceeded");
```
Proves the payment does not push total daily spending over the configured limit.

### Constraint 3 — Operator Role
```noir
assert(operator_role >= min_operator_role as u8, "Insufficient operator role");
assert(operator_role <= 3, "Invalid role");
```
Proves the payment initiator has sufficient role to authorize payments. Admins (role 3) can always pay regardless of the minimum setting.

### Constraint 4 — Policy Hash Binding
```noir
let computed_hash = pedersen_hash([
    spending_limit, daily_spend_limit,
    multisig_threshold as Field, min_operator_role as Field,
    allowed_jurisdictions_root
]);
assert(computed_hash == policy_hash, "Policy hash mismatch");
```
This is the critical constraint. The proof is bound to the exact policy stored in `PolicyEngine`. If the institution changes their policy after the proof is generated, the proof becomes invalid. This ensures payments always comply with the current policy.

### Constraint 5 — Timestamp
```noir
assert(timestamp > 0, "Invalid timestamp");
```
Basic freshness check.

---

## Policy Hash

The policy hash is a Pedersen hash of all policy parameters. It is computed in the Admin panel using Barretenberg's in-browser Pedersen implementation:

```typescript
const policyHash = await pedersenHash([
    BigInt(spendingLimit),
    BigInt(dailySpendLimit),
    BigInt(multisigThreshold),
    BigInt(minKycLevel),
    BigInt(minRole),
    BigInt(allowedJurisdictionsRoot),
])
```

This hash is stored in `PolicyEngine` on-chain. The circuit recomputes it from the private inputs and checks it matches. If an institution tries to use an outdated or different policy configuration, the proof fails.

---

## On-Chain Verification

Deployed at: `0x73D360fAC06136AFb6BCAD0e08863383FAc8CB89` (HashKey Chain Testnet)

```solidity
function verify(
    bytes calldata proof,
    bytes32[] calldata publicInputs
) external view returns (bool);
```

`ZKTreasury` calls both `IdentityVerifier.verify()` and `PolicyVerifier.verify()` in the same transaction. Both must return true for the payment to execute.

---

## Public Input Layout

The contract reads specific indices from the `publicInputs` array:

```solidity
uint256 private constant POL_IDX_SPENDING_LIMIT     = 0;
uint256 private constant POL_IDX_DAILY_LIMIT        = 1;
uint256 private constant POL_IDX_MULTISIG_THRESHOLD = 2;
uint256 private constant POL_IDX_MIN_ROLE           = 3;
uint256 private constant POL_IDX_JURISDICTIONS_ROOT = 4;
uint256 private constant POL_IDX_POLICY_HASH        = 5;
uint256 private constant POL_IDX_PAYMENT_REQ_ID     = 6;
uint256 private constant POL_IDX_POLICY_HASH        = 7;
```

The contract checks that `publicInputs[POL_IDX_POLICY_HASH]` matches the hash stored in `PolicyEngine` for this treasury, ensuring the proof was generated against the current policy.
