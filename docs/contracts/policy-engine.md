# PolicyEngine

`PolicyEngine` is the on-chain storage contract for treasury spending policies. It is the single source of truth for what each treasury's ZK proofs must be bound to.

---

## Overview

When an institution deploys a treasury and sets a policy, the policy parameters are stored in `PolicyEngine`. When a payment is initiated, the policy circuit's ZK proof includes the Pedersen hash of these parameters as a public input. The `ZKTreasury` contract checks that this hash matches what `PolicyEngine` returns — if they differ, the proof is invalid.

This binding mechanism means that if an institution changes their policy, all previously generated proofs (with the old policy hash) become invalid. New proofs must be generated against the updated policy. This is a deliberate security feature.

---

## Policy Struct

```solidity
struct Policy {
    uint256 spendingLimit;            // Maximum per-transaction amount (token base units)
    uint256 dailySpendLimit;          // Maximum daily total across all operators
    uint8   multisigThreshold;        // Number of required approvals (0 = single sig)
    uint8   minKycLevel;              // Minimum recipient KYC tier (1-4)
    uint8   minRole;                  // Minimum operator role (1=Viewer, 2=Operator, 3=Admin)
    bool    active;                   // Whether the policy is active
    bytes32 allowedJurisdictionsRoot; // Merkle root of allowed jurisdiction set
    bytes32 policyHash;               // Pedersen hash of all parameters (ZK binding)
}
```

---

## Core Functions

### setPolicy

```solidity
function setPolicy(
    uint256 spendingLimit,
    uint256 dailySpendLimit,
    uint8   multisigThreshold,
    uint8   minKycLevel,
    uint8   minRole,
    bytes32 allowedJurisdictionsRoot,
    bytes32 policyHash
) external
```

Called by `ZKTreasury.updatePolicy()`. Only callable by a registered treasury contract — not by any wallet directly. The policy is stored under `msg.sender` (the treasury's address).

### getPolicy

```solidity
function getPolicy(address treasury) external view returns (Policy memory)
```

Returns the full policy struct for a treasury. Called by the frontend to display policy information on the dashboard.

### getPolicyHash

```solidity
function getPolicyHash(address treasury) external view returns (bytes32)
```

Returns just the policy hash. Called by `ZKTreasury.executePayment()` to verify the policy proof is bound to the current policy.

---

## Policy Hash Computation

The policy hash is a Pedersen hash computed in-browser by Barretenberg:

```typescript
// In the Admin panel / institution/new page
const policyHash = await pedersenHash([
    BigInt(spendingLimit),
    BigInt(dailySpendLimit),
    BigInt(multisigThreshold),
    BigInt(minKycLevel),
    BigInt(minRole),
    BigInt(allowedJurisdictionsRoot),
])
```

The ZK policy circuit recomputes this hash from the private inputs and verifies it matches the public `policy_hash` input. The `ZKTreasury` then checks that this public input matches `PolicyEngine.getPolicyHash(address(this))`.

The full verification chain:

```
Policy params (private) → Pedersen hash (in circuit) = policy_hash (public)
                                                              ↕ must match
                                              PolicyEngine.getPolicyHash(treasury)
```

---

## Policy Activation

A policy becomes active on the first call to `setPolicy`. Before activation, all policy values are zero and the `active` flag is false. A `ZKTreasury` with an inactive policy cannot execute payments — this is how the 7-step deployment flow enforces that institutions complete policy setup before using their treasury.

---

## Daily Spend Tracking

`PolicyEngine` tracks daily spending per treasury:

```solidity
mapping(address => mapping(uint256 => uint256)) public dailySpent;
// treasury → day (block.timestamp / 86400) → amount spent
```

The policy circuit receives `daily_spent` as a private input and proves `daily_spent + amount <= daily_spend_limit`. The contract does not verify this directly — it relies on the ZK proof to enforce the daily limit constraint.

This is an important security consideration: the daily spend tracking in the circuit is private, meaning an operator could theoretically provide an incorrect `daily_spent` value to bypass the daily limit. In Phase 2, this will be enforced on-chain via a spend tracker in `PolicyEngine`.
