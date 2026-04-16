# NexashUserRegistry

`NexashUserRegistry` is the on-chain profile system for individual Nexash users. It stores usernames, wallet addresses, KYC verification status, and NexaID attestation anchors.

---

## Overview

When an individual completes Nexash's identity verification flow, their verified status is permanently recorded in `NexashUserRegistry`. Institutions look up recipient profiles from this registry when initiating payments — they do not need to ask the recipient for their attestation data manually.

---

## UserProfile Struct

```solidity
struct UserProfile {
    string   username;     // Unique handle (e.g. "zaid")
    address  wallet;       // Wallet address
    bool     verified;     // Has passed ZK identity verification
    uint8    kycLevel;     // KYC tier from ZK proof (1-4)
    bytes32  nullifier;    // Proof nullifier (replay prevention)
    bytes32  reportTxHash; // NexaID on-chain attestation tx hash
    bytes32  taskId;       // NexaID attestation task ID
    uint256  registeredAt; // Registration timestamp
    uint256  verifiedAt;   // Verification timestamp
}
```

---

## Core Functions

### register

```solidity
function register(string calldata username) external notOrgMember
```

Registers a new username. Requirements:
- Username must be 3-20 characters
- Only lowercase letters, numbers, underscores allowed
- Username must not already be taken
- Wallet must not be a member of an organization

### verifyIdentity

```solidity
function verifyIdentity(
    bytes calldata proof,
    bytes32[] calldata publicInputs,
    bytes32 reportTxHash,
    bytes32 taskId
) external nonReentrant
```

Submits a UltraHonk identity proof for on-chain verification. Performs:

1. Checks user is registered and not yet verified
2. Extracts nullifier from `publicInputs[2]`
3. Checks nullifier not previously used
4. Verifies `treasury_address` in proof matches `address(this)`
5. Calls `identityVerifier.verify(proof, publicInputs)`
6. Stores: `verified=true`, `kycLevel`, `nullifier`, `reportTxHash`, `taskId`
7. Calls `kycSBT.setKyc(msg.sender, kycLevel, 1, ensName)` to mint HashKey SBT
8. Emits `UserVerified`

### getProfile

```solidity
function getProfile(address wallet) external view returns (UserProfile memory)
```

Returns the full profile for a wallet address. Used by institutions to look up recipient KYC status automatically.

### resolve

```solidity
function resolve(string calldata username) external view returns (address)
```

Resolves a username to a wallet address. Used for the `nexash/@username` payment link feature.

---

## Mutual Exclusivity with OrgRegistry

A wallet cannot be both an individual user and an institution admin simultaneously. `NexashUserRegistry` checks `NexashOrgRegistry` on registration, and vice versa, enforcing this constraint.

---

## MockKycSBT Auto-Minting

When `verifyIdentity` succeeds, the registry automatically calls:

```solidity
if (address(kycSBT) != address(0)) {
    string memory ensName = string(abi.encodePacked(
        profiles[msg.sender].username, ".nexash"
    ));
    try kycSBT.setKyc(msg.sender, kycLevel, 1, ensName) {} catch {}
}
```

This mints a HashKey KYC soul-bound token representing the user's verified status. The `try/catch` ensures verification succeeds even if SBT minting fails. The registry is the owner of `MockKycSBT`, transferred during deployment.

---

## Events

```solidity
event UserRegistered(address indexed wallet, string username, uint256 timestamp);
event UserVerified(address indexed wallet, uint8 kycLevel, bytes32 nullifier);
event UsernameChanged(address indexed wallet, string oldUsername, string newUsername);
```

---

## OpenZeppelin Usage

- `Ownable2Step` — Two-step ownership for safe admin transfer
- `ReentrancyGuard` — Protection on `verifyIdentity`
