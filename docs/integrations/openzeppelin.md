# OpenZeppelin Integration

Nexash uses OpenZeppelin contracts as the foundation for all security-critical functionality. Rather than implementing access control, reentrancy protection, or token handling from scratch, Nexash builds on the most audited and battle-tested contracts in the Solidity ecosystem.

---

## Why OpenZeppelin?

**Security first** — OpenZeppelin contracts have been audited dozens of times by top security firms. The patterns they implement (role-based access control, reentrancy guards, pausable contracts) are notoriously easy to get wrong from scratch. Using OpenZeppelin eliminates entire categories of vulnerabilities.

**Auditability** — When an auditor reviews Nexash's contracts and sees `ReentrancyGuard`, they immediately understand the protection in place. Custom implementations require explaining and justifying each design choice.

**Maintenance** — OpenZeppelin actively maintains their contracts and responds to newly discovered vulnerability classes. Nexash benefits from this maintenance automatically.

---

## Contracts Used

### Ownable (`@openzeppelin/contracts/access/Ownable.sol`)

**Used in:** `TreasuryFactory`, `PolicyEngine`, `KYCGate`, `MockKycSBT`

`Ownable` provides a single-owner access control pattern. The deployer is the initial owner. Ownership can be transferred to another address.

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract PolicyEngine is Ownable {
    constructor() Ownable(msg.sender) {}
    
    function setAuthorizedCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = true;
    }
}
```

**Why Ownable for these contracts:** `PolicyEngine` and `KYCGate` need a simple owner who can authorize new callers (treasury contracts and registries respectively). `TreasuryFactory` needs an owner to update infrastructure addresses if contracts are redeployed. The single-owner model is appropriate for these administrative contracts.

---

### Ownable2Step (`@openzeppelin/contracts/access/Ownable2Step.sol`)

**Used in:** `NexashUserRegistry`, `NexashOrgRegistry`

`Ownable2Step` extends `Ownable` with a two-step ownership transfer process:

1. Current owner calls `transferOwnership(newOwner)` — queues the transfer
2. New owner calls `acceptOwnership()` — confirms and completes the transfer

If step 2 is never called, ownership stays with the original owner. This prevents irreversible ownership loss from typos or copy-paste errors in the new owner address.

```solidity
import "@openzeppelin/contracts/access/Ownable2Step.sol";

contract NexashUserRegistry is Ownable2Step, ReentrancyGuard {
    constructor() Ownable(msg.sender) {}
    
    // Owner can update the identity verifier if circuits change
    function setIdentityVerifier(address _verifier) external onlyOwner {
        identityVerifier = IIdentityVerifier(_verifier);
    }
    
    // Owner can update the KYC SBT if the standard changes
    function setKycSBT(address _kycSBT) external onlyOwner {
        kycSBT = IMockKycSBT(_kycSBT);
    }
}
```

**Why Ownable2Step for registries:** `NexashUserRegistry` stores user profiles and is the owner of `MockKycSBT`. Accidentally transferring registry ownership to a wrong address could lock users out of KYC SBT minting permanently. The two-step confirmation prevents this.

---

### ReentrancyGuard (`@openzeppelin/contracts/utils/ReentrancyGuard.sol`)

**Used in:** `ZKTreasury`, `NexashUserRegistry`

`ReentrancyGuard` prevents a contract function from being called again before its first invocation completes. It uses a state variable that flips between "entered" and "not entered" states.

```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ZKTreasury is ReentrancyGuard, Pausable {
    
    function executePayment(
        address token,
        address recipient,
        uint256 amount,
        // ... proof params
    ) external onlyOperator nonReentrant whenNotPaused {
        // This function cannot be re-entered
        // Even if the ERC-20 token has a malicious callback
        
        // ... verify proofs ...
        
        IERC20(token).transfer(recipient, amount);  // External call — safe from reentrancy
    }
}
```

**Why critical for ZKTreasury:** The payment execution path calls `IERC20.transfer()` — an external call to a potentially untrusted contract. If the token's `transfer` function had a malicious callback that re-entered `executePayment`, it could:
- Execute the same payment twice
- Use the same nullifier before it is marked as used
- Drain the treasury beyond policy limits

`nonReentrant` prevents all of these attacks by ensuring the function completes fully before any re-entry is possible.

**Why critical for NexashUserRegistry:** `verifyIdentity` calls `identityVerifier.verify()` (external) and `kycSBT.setKyc()` (external). While both are trusted contracts, the `nonReentrant` guard provides defense-in-depth against unexpected callback chains.

---

### Pausable (`@openzeppelin/contracts/utils/Pausable.sol`)

**Used in:** `ZKTreasury`

`Pausable` allows an authorized address to halt all state-changing operations. Functions marked `whenNotPaused` revert while the contract is paused.

```solidity
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ZKTreasury is ReentrancyGuard, Pausable {
    
    // Admin can pause all payments
    function pause() external onlyAdmin {
        _pause();
        emit Paused(msg.sender);
    }
    
    // Admin can unpause
    function unpause() external onlyAdmin {
        _unpause();
        emit Unpaused(msg.sender);
    }
    
    // All payment execution is blocked when paused
    function executePayment(...) external onlyOperator nonReentrant whenNotPaused {
        // Reverts if paused
    }
}
```

**Why critical for ZKTreasury:** If a vulnerability is discovered in the ZK circuits or verifier contracts, institutions need to be able to immediately halt all payment execution while the issue is investigated and fixed. Without a pause mechanism, there is no way to stop in-flight payments if the contracts are compromised.

The pause is per-treasury — each treasury can be paused independently without affecting others. An institutional admin can pause their own treasury without any central authority being involved.

---

### IERC20 (`@openzeppelin/contracts/token/ERC20/IERC20.sol`)

**Used in:** `ZKTreasury`

`IERC20` is the standard interface for ERC-20 tokens. Nexash uses it for all token interactions — deposits, withdrawals, and payment transfers.

```solidity
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ZKTreasury {
    
    function deposit(address token, uint256 amount) external {
        require(allowedTokens[token], "Token not allowed");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        emit Deposited(token, msg.sender, amount);
    }
    
    function _executePayment(
        address token,
        address recipient,
        uint256 amount,
        bytes32 paymentReqId
    ) internal {
        require(
            IERC20(token).balanceOf(address(this)) >= amount,
            "ZKTreasury: insufficient balance"
        );
        IERC20(token).transfer(recipient, amount);
        emit PaymentExecuted(paymentReqId, recipient, amount);
    }
    
    function withdraw(address token, uint256 amount) external onlyAdmin {
        IERC20(token).transfer(msg.sender, amount);
    }
}
```

**Why IERC20 instead of SafeERC20:** Nexash only allows explicitly whitelisted tokens (USDC.e and USDT on HashKey testnet). These tokens are known to comply with the standard ERC-20 interface and return `bool` correctly from `transfer`. For unknown tokens where `SafeERC20` is warranted, the token must first be added to the allowlist by an admin.

---

## Security Patterns Not From OpenZeppelin

### Custom Role System

`ZKTreasury` implements a four-tier role system not covered by OpenZeppelin's `AccessControl`. This is because Nexash's roles are additive (Admin can do everything Operator can do) rather than orthogonal, and roles need to be stored per-member as `uint8` values for the ZK policy circuit to reference.

```solidity
// Role definitions
uint8 public constant ROLE_NONE     = 0;
uint8 public constant ROLE_VIEWER   = 1;
uint8 public constant ROLE_OPERATOR = 2;
uint8 public constant ROLE_ADMIN    = 3;

mapping(address => uint8) public roles;

modifier onlyAdmin() {
    require(roles[msg.sender] == ROLE_ADMIN, "ZKTreasury: not admin");
    _;
}

modifier onlyOperator() {
    require(roles[msg.sender] >= ROLE_OPERATOR, "ZKTreasury: not operator");
    _;
}
```

### Nullifier-Based Replay Prevention

This is a ZK-specific pattern not covered by any OpenZeppelin contract. After a proof is used, its nullifier is stored and checked:

```solidity
mapping(bytes32 => bool) public usedNullifiers;

// In executePayment:
bytes32 nullifier = bytes32(identityPubInputs[ID_IDX_NULLIFIER]);
require(!usedNullifiers[nullifier], "ZKTreasury: nullifier already used");

// After successful verification:
usedNullifiers[nullifier] = true;
```

---

## OpenZeppelin Version

Nexash uses OpenZeppelin Contracts v5.x (Solidity 0.8.28). Key changes from v4 that affect Nexash:

- `Ownable` constructor now requires the initial owner as an explicit argument: `Ownable(msg.sender)` rather than `Ownable()`
- `AccessControl` uses `DEFAULT_ADMIN_ROLE` pattern (not used by Nexash)
- `ReentrancyGuard` is slightly more gas-efficient in v5

```solidity
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
```

---

## What OpenZeppelin Does Not Cover

The following security properties in Nexash are **not** from OpenZeppelin and represent custom cryptographic/ZK-specific logic:

| Feature | Implementation |
|---|---|
| ZK proof verification | Barretenberg UltraHonk verifier (generated by `nargo`) |
| Nullifier storage | Custom `mapping(bytes32 => bool)` |
| Policy hash binding | Custom Pedersen hash comparison |
| Proof expiry | Custom timestamp comparison against `PROOF_EXPIRY` |
| Public input layout | Custom index constants (e.g. `ID_IDX_NULLIFIER = 2`) |

These components are the most security-critical parts of Nexash and are the primary targets for external audit.
