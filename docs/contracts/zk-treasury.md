# ZKTreasury

The `ZKTreasury` contract is the core of Nexash's institutional payment system. Each institution has one or more `ZKTreasury` instances, deployed via `TreasuryFactory`.

---

## Overview

`ZKTreasury` is a non-custodial smart contract treasury that:
- Holds institutional funds (USDC, USDT, or any ERC-20)
- Enforces spending policy via ZK proof verification
- Requires recipient KYC compliance proof before releasing funds
- Maintains a complete on-chain payment history

No payment can execute without two valid UltraHonk proofs: one proving the recipient is KYC-compliant, and one proving the payment is within policy.

---

## Constructor Parameters

```solidity
constructor(
    string memory _name,
    address _admin,
    address _identityVerifier,
    address _policyVerifier,
    address _policyEngine,
    address _kycGate,
    address _hspAdapter,
    bytes32 _policyHash
)
```

| Parameter | Description |
|---|---|
| `_name` | Display name for the treasury |
| `_admin` | Initial admin wallet address |
| `_identityVerifier` | Address of the UltraHonk identity verifier |
| `_policyVerifier` | Address of the UltraHonk policy verifier |
| `_policyEngine` | Address of the PolicyEngine contract |
| `_kycGate` | Address of the KYCGate contract |
| `_hspAdapter` | Address of the HSPAdapter contract |
| `_policyHash` | Initial policy hash (can be zero, updated via updatePolicy) |

---

## Role System

ZKTreasury uses a four-tier role system:

| Role | Value | Permissions |
|---|---|---|
| None | 0 | No access |
| Viewer | 1 | Read-only access |
| Operator | 2 | Can initiate payments (subject to policy) |
| Admin | 3 | Full control: add members, update policy, pause |

---

## Core Functions

### executePayment

```solidity
function executePayment(
    address token,
    address recipient,
    uint256 amount,
    bytes32 paymentReqId,
    bytes calldata identityProof,
    bytes32[] calldata identityPubInputs,
    bytes calldata policyProof,
    bytes32[] calldata policyPubInputs
) external onlyOperator onlyInitialized whenNotPaused
```

The primary payment function. Performs the following checks in order:

1. Caller has Operator role or above
2. Treasury is initialized and not paused
3. Identity public inputs count == 7
4. Policy public inputs count == 7
5. Nullifier (from identity proof) not previously used
6. Proof timestamps are within expiry window
7. Policy proof is bound to this treasury's current policy hash
8. Identity proof is verified by `IdentityVerifier`
9. Policy proof is verified by `PolicyVerifier`
10. Treasury has sufficient balance
11. Executes `IERC20.transfer(recipient, amount)`
12. Records nullifier and payment request ID as used
13. Emits `PaymentExecuted` event

### updatePolicy

```solidity
function updatePolicy(
    uint256 _spendingLimit,
    uint256 _dailySpendLimit,
    uint8 _multisigThreshold,
    uint8 _minKycLevel,
    uint8 _minRole,
    bytes32 _allowedJurisdictionsRoot,
    bytes32 _policyHash
) external onlyAdmin onlyInitialized
```

Updates the treasury's spending policy. Calls `PolicyEngine.setPolicy()` with the new parameters and the Pedersen hash that binds ZK proofs to this exact policy.

### deposit / withdraw

```solidity
function deposit(address token, uint256 amount) external
function withdraw(address token, uint256 amount) external onlyAdmin
```

Standard ERC-20 deposit and withdrawal. Only admins can withdraw.

---

## Events

```solidity
event PaymentExecuted(
    bytes32 indexed paymentRequestId,
    address indexed recipient,
    uint256 amount
);

event PolicyUpdated(bytes32 policyHash);
event MemberAdded(address indexed member, uint8 role);
event MemberRemoved(address indexed member);
event TokenAdded(address indexed token);
event TokenRemoved(address indexed token);
event Paused(address indexed by);
event Unpaused(address indexed by);
```

---

## Security Features

**Nullifier storage:** Every identity proof includes a nullifier. After a successful payment, the nullifier is stored in `usedNullifiers[bytes32]`. If the same proof is submitted again, the payment reverts. This prevents replay attacks.

**Payment request deduplication:** The `paymentReqId` (from the policy circuit) is also stored after use. This prevents the same payment request from being executed twice.

**Proof expiry:** Both proof timestamps are checked against `block.timestamp + PROOF_EXPIRY` (configurable, default 1 hour). Stale proofs cannot be used.

**Reentrancy protection:** All payment paths use OpenZeppelin's `ReentrancyGuard`.

**Emergency pause:** Admins can pause the treasury, preventing all payment execution. The pause can be lifted by any admin.

---

## Integration with OpenZeppelin

`ZKTreasury` uses several OpenZeppelin components:

- `Pausable` — Emergency stop mechanism
- `ReentrancyGuard` — Protection against reentrancy in payment paths
- `IERC20` — Standard token interface for deposits, withdrawals, and transfers
