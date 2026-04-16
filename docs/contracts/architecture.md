# Contract Architecture

Nexash's smart contract suite is composed of ten contracts working together to enable ZK-gated institutional payments. Each contract has a single, well-defined responsibility.

---

## Design Principles

**Separation of concerns** — Each contract does one thing. `ZKTreasury` executes payments. `PolicyEngine` stores policy. `IdentityVerifier` verifies proofs. No contract tries to do everything.

**Upgradability through redeployment** — Nexash contracts are not upgradeable proxies. When circuits change, new verifier contracts are deployed and registries are updated to point to them. This is simpler and more auditable than proxy patterns.

**Minimal on-chain storage** — Only what is necessary is stored on-chain. ZK proof bytes are not stored — only the verification result and nullifiers. This keeps gas costs low and the chain clean.

**OpenZeppelin as foundation** — All access control, reentrancy protection, and token handling uses battle-tested OpenZeppelin contracts. No custom implementations of security primitives.

---

## Contract Dependency Graph

```
TreasuryFactory
      │
      │ deploys
      ▼
ZKTreasury ─────────────→ IdentityVerifier
      │                         (UltraHonk)
      │ ─────────────────→ PolicyVerifier
      │                         (UltraHonk)
      │ ─────────────────→ PolicyEngine
      │                    (stores policy)
      │ ─────────────────→ KYCGate
      │                         │
      │                         ▼
      │                    MockKycSBT
      │                    (HashKey SBT)
      │ ─────────────────→ HSPAdapter
      │                    (HashKey Pay)
      │
NexashUserRegistry ──────→ IdentityVerifier
      │                    (same verifier)
      │ ─────────────────→ MockKycSBT
      │                    (auto-mints SBT)
      │
NexashOrgRegistry ───────→ NexashUserRegistry
      │                    (mutual exclusivity)
      │
      └─ linked to NexashUserRegistry
         (both registries wire together)
```

---

## Contract Overview Table

| Contract | Lines | Inherits | Key Dependencies |
|---|---|---|---|
| `ZKTreasury` | ~450 | `ReentrancyGuard`, `Pausable` | `IIdentityVerifier`, `IPolicyVerifier`, `IPolicyEngine`, `IKYCGate`, `IERC20` |
| `TreasuryFactory` | ~100 | `Ownable` | `ZKTreasury` |
| `PolicyEngine` | ~120 | `Ownable` | — |
| `IdentityVerifier` | ~500 | — | Barretenberg UltraHonk (generated) |
| `PolicyVerifier` | ~500 | — | Barretenberg UltraHonk (generated) |
| `NexashUserRegistry` | ~260 | `Ownable2Step`, `ReentrancyGuard` | `IIdentityVerifier`, `IMockKycSBT` |
| `NexashOrgRegistry` | ~200 | `Ownable2Step` | `INexashUserRegistry` |
| `KYCGate` | ~80 | `Ownable` | `IKycSBT` |
| `MockKycSBT` | ~60 | `Ownable` | `IKycSBT` |
| `HSPAdapter` | ~40 | — | — |

---

## Interfaces

All cross-contract calls go through interfaces, enabling future contract upgrades without changing callers:

```solidity
interface IIdentityVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool);
}

interface IPolicyVerifier {
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external view returns (bool);
}

interface IPolicyEngine {
    function setPolicy(uint256, uint256, uint8, uint8, uint8, bytes32, bytes32) external;
    function getPolicy(address treasury) external view returns (Policy memory);
    function getPolicyHash(address treasury) external view returns (bytes32);
}

interface IKycSBT {
    function getKycLevel(address account) external view returns (uint8);
    function meetsKycLevel(address account, uint8 level) external view returns (bool);
}

interface IMockKycSBT {
    function setKyc(address account, uint8 level, uint8 status, string calldata ensName) external;
}
```

---

## Storage Layout

### ZKTreasury Storage

```solidity
// Immutable (set at construction)
string public name;
address public immutable identityVerifier;
address public immutable policyVerifier;
address public immutable policyEngine;
address public immutable kycGate;
address public immutable hspAdapter;

// State
bool public initialized;
bool public paused;
mapping(address => uint8) public roles;           // wallet → role (0-3)
mapping(address => bool) public allowedTokens;    // token → allowed
mapping(bytes32 => bool) public usedNullifiers;   // nullifier → used
mapping(bytes32 => bool) public usedPaymentRequests; // payReqId → used
mapping(bytes32 => PendingPayment) public pendingPayments; // for multisig
```

### NexashUserRegistry Storage

```solidity
IIdentityVerifier public identityVerifier;
IMockKycSBT public kycSBT;
address public orgRegistry;

mapping(bytes32 => address) public usernameToAddress;  // keccak(username) → wallet
mapping(address => UserProfile) public profiles;        // wallet → profile
mapping(bytes32 => bool) public usedNullifiers;         // nullifier → used

uint256 public totalUsers;
uint256 public totalVerified;
```

### PolicyEngine Storage

```solidity
mapping(address => Policy) private policies;  // treasury → policy

struct Policy {
    uint256 spendingLimit;
    uint256 dailySpendLimit;
    uint8   multisigThreshold;
    uint8   minKycLevel;
    uint8   minRole;
    bool    active;
    bytes32 allowedJurisdictionsRoot;
    bytes32 policyHash;
}
```

---

## Gas Costs (Approximate)

| Operation | Gas | Notes |
|---|---|---|
| Deploy ZKTreasury | ~2,500,000 | One-time per treasury |
| Register username | ~80,000 | One-time per user |
| Verify identity | ~350,000 | Includes UltraHonk verification |
| Execute payment | ~750,000 | Both proofs verified on-chain |
| Update policy | ~45,000 | Admin operation |
| Deposit | ~65,000 | ERC-20 transfer + storage |

---

## Deployment Scripts

Nexash uses Foundry for deployment:

```bash
# Deploy all core contracts
forge script script/Deploy.s.sol \
  --rpc-url https://testnet.hsk.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast

# Deploy registries (after core contracts)
forge script script/DeployRegistries.s.sol \
  --rpc-url https://testnet.hsk.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast
```

The deploy scripts are idempotent for PolicyEngine — if `POLICY_ENGINE` is set in the environment, it reuses the existing deployment rather than deploying a new one. This prevents the common issue of factory contracts pointing to different policy engines across deployments.
