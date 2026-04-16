# NexashOrgRegistry

`NexashOrgRegistry` is the on-chain profile system for institutions. It stores organization names, admin wallets, and links to their deployed treasuries.

---

## Overview

When an institution registers on Nexash, their profile is stored in `NexashOrgRegistry`. This registry serves as the directory of all institutions on the platform and provides the mutual exclusivity constraint — a wallet that is an institution admin cannot also be an individual user.

---

## OrgProfile Struct

```solidity
struct OrgProfile {
    string  name;           // Organization display name
    string  displayName;    // Optional shorter display name
    string  description;    // Organization description
    address admin;          // Primary admin wallet
    uint256 registeredAt;   // Registration timestamp
    uint256 treasuryCount;  // Number of treasuries deployed
    bool    active;         // Whether the org is active
}
```

---

## Core Functions

### register

```solidity
function register(
    string calldata name,
    string calldata displayName,
    string calldata description
) external notUserMember
```

Registers a new organization. The `msg.sender` becomes the admin. Requirements:
- Wallet must not be registered as an individual user in `NexashUserRegistry`
- Organization name must not already be taken

### addTreasury

```solidity
function addTreasury(address treasury) external
```

Called by `TreasuryFactory` after deploying a new treasury. Records the treasury under the admin's organization profile.

### getProfile

```solidity
function getProfile(address admin) external view returns (OrgProfile memory)
```

Returns the full organization profile for an admin wallet.

### getOrgTreasuries

```solidity
function getOrgTreasuries(address admin) external view returns (address[] memory)
```

Returns all treasury addresses for a given organization admin. Used by the institution dashboard to list all treasuries.

---

## Mutual Exclusivity

`NexashOrgRegistry` and `NexashUserRegistry` are wired together during deployment:

```solidity
// NexashOrgRegistry checks NexashUserRegistry
modifier notUserMember() {
    if (userRegistry != address(0)) {
        require(
            !INexashUserRegistry(userRegistry).isRegistered(msg.sender),
            "OrgRegistry: wallet is a user"
        );
    }
    _;
}
```

```solidity
// NexashUserRegistry checks NexashOrgRegistry
modifier notOrgMember() {
    if (orgRegistry != address(0)) {
        (bool isOrg,) = _checkIsOrg(msg.sender);
        require(!isOrg, "UserRegistry: wallet is an org member");
    }
    _;
}
```

This prevents the same wallet from acting as both a payment recipient and a payment sender — preserving clear roles in the payment system.

---

## Events

```solidity
event OrgRegistered(address indexed admin, string name, uint256 timestamp);
event TreasuryAdded(address indexed admin, address indexed treasury);
event OrgUpdated(address indexed admin);
```

---

## Deployed Address

`NexashOrgRegistry`: `0xB68fBED9B78077213FCC02CA4FbA8A479ae24bF3` (HashKey Chain Testnet)
