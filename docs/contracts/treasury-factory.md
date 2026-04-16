# TreasuryFactory

`TreasuryFactory` is the factory contract that deploys new `ZKTreasury` instances for institutions. It maintains a registry of all deployed treasuries and wires each one to the correct infrastructure contracts.

---

## Purpose

Without `TreasuryFactory`, institutions would need to manually deploy `ZKTreasury` with the correct addresses for `IdentityVerifier`, `PolicyVerifier`, `PolicyEngine`, `KYCGate`, and `HSPAdapter`. A single mistake in any address would break the treasury permanently.

`TreasuryFactory` solves this by:
- Holding the canonical addresses of all infrastructure contracts
- Deploying correctly wired `ZKTreasury` instances in a single transaction
- Maintaining a queryable list of all deployed treasuries

---

## Constructor

```solidity
constructor(
    address _identityVerifier,
    address _policyVerifier,
    address _policyEngine,
    address _kycGate,
    address _hspAdapter
)
```

Set once at deployment. These infrastructure addresses are immutable in the factory — upgrading to new verifiers requires deploying a new factory.

---

## Core Functions

### deployTreasury

```solidity
function deployTreasury(
    string calldata name,
    bytes32 initialPolicyHash
) external returns (address treasury)
```

Deploys a new `ZKTreasury` with:
- `_admin` = `msg.sender` (the institution's wallet)
- All infrastructure addresses from factory storage
- `_policyHash` = `initialPolicyHash` (can be zero, updated after deployment)

Adds the new treasury to `allTreasuries` array and emits `TreasuryDeployed`.

### getAllTreasuries

```solidity
function getAllTreasuries() external view returns (address[] memory)
```

Returns all treasury addresses ever deployed by this factory. Used by the individual dashboard to scan payment events across all treasuries.

### getInstitutionTreasuries

```solidity
function getInstitutionTreasuries(address admin) external view returns (address[] memory)
```

Returns all treasuries deployed by a specific admin address.

---

## Events

```solidity
event TreasuryDeployed(
    address indexed treasury,
    address indexed admin,
    string name,
    uint256 timestamp
);
```

---

## The 7-Step Deployment Flow

The frontend guides institutions through a 7-step treasury deployment:

**Step 1 — Configure**
Institution fills in treasury name and all policy parameters in the UI.

**Step 2 — Simulate**
Frontend calls `eth_call` with the deployment parameters to check for errors before sending a real transaction.

**Step 3 — Deploy**
Institution signs `TreasuryFactory.deployTreasury(name, bytes32(0))`. Note: the policy hash is initially zero. This is intentional — the Pedersen hash computation happens in the next steps.

**Step 4 — Confirm**
Frontend waits for the deployment transaction to be mined and reads the new treasury address from the `TreasuryDeployed` event.

**Step 5 — Compute Policy Hash**
Barretenberg's Pedersen hash runs in-browser with the policy parameters to compute the exact policy hash that ZK proofs will verify against.

**Step 6 — Update Policy**
Institution signs `ZKTreasury.updatePolicy(spendingLimit, dailyLimit, threshold, minKyc, minRole, jurisdictionsRoot, policyHash)`. This stores the policy in `PolicyEngine` and records the policy hash.

**Step 7 — Register**
The treasury is registered to the institution's profile in `NexashOrgRegistry`.

---

## Why Zero Initial Policy Hash?

The Pedersen hash of the policy parameters cannot be computed in Solidity at deployment time — it requires Barretenberg's specific implementation of Pedersen hash over BN254. The two-phase approach (deploy with zero hash, then update with real hash) ensures the policy hash is always computed by the same Barretenberg library used by the ZK prover, guaranteeing consistency.
