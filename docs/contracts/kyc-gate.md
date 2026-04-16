# KYCGate & MockKycSBT

`KYCGate` and `MockKycSBT` form Nexash's integration with HashKey Chain's native KYC soul-bound token standard. They bridge Nexash's ZK-based identity verification with HashKey's on-chain SBT ecosystem.

---

## The KYC SBT Standard

HashKey Chain has a native standard for on-chain KYC verification using soul-bound tokens (SBTs) — non-transferable NFTs that represent identity attributes. SBTs are widely used across HashKey's DeFi ecosystem: protocols can check an address's SBT status as a condition for participation.

Nexash integrates this standard so that Nexash-verified users automatically become participants in the broader HashKey ecosystem, without requiring separate verification for each protocol.

---

## MockKycSBT

`MockKycSBT` is Nexash's implementation of the HashKey KYC SBT standard. On testnet, it is "mock" in the sense that there is no real token economics — it is a faithful implementation of the `IKycSBT` interface for testing and integration purposes.

### KycRecord Struct

```solidity
struct KycRecord {
    KycLevel  level;       // Enum: None, Basic, Intermediate, Advanced, Premium
    KycStatus status;      // Enum: None, Active, Suspended
    uint256   createTime;  // Timestamp of SBT issuance
    string    ensName;     // ENS-style name (e.g. "zaid.nexash")
}
```

### setKyc Function

```solidity
function setKyc(
    address account,
    uint8 level,      // KycLevel enum value
    uint8 status,     // KycStatus enum value (1 = Active)
    string calldata ensName
) external onlyOwner
```

Only the contract owner can call `setKyc`. On deployment, ownership of `MockKycSBT` is transferred to `NexashUserRegistry`, which calls `setKyc` automatically when a user completes ZK identity verification.

### getKycLevel / meetsKycLevel

```solidity
function getKycLevel(address account) external view returns (uint8)
function meetsKycLevel(address account, uint8 requiredLevel) external view returns (bool)
```

Used by `KYCGate` to check if an address has sufficient KYC status.

---

## KYCGate

`KYCGate` is the verification gateway that other contracts call to check KYC status. It abstracts the SBT lookup behind a simple interface.

```solidity
function meetsKycLevel(address account, uint8 requiredLevel) 
    external view returns (bool) 
{
    uint8 level = kycSBT.getKycLevel(account);
    return level >= requiredLevel;
}
```

`ZKTreasury` originally called `KYCGate.meetsKycLevel(recipient, policy.minKycLevel)` as an additional check alongside ZK proof verification. This check was removed because:

1. The ZK identity proof already proves KYC compliance — a redundant on-chain SBT check adds gas cost without security benefit
2. Users who verified via NexaID would fail the check until `NexashUserRegistry` minted their SBT
3. The ZK proof is the authoritative verification; the SBT is a convenience for other protocols

The SBT is still minted after ZK verification — it just is not used as a payment gate.

---

## Auto-Minting Flow

When a user completes `NexashUserRegistry.verifyIdentity()`:

```solidity
// After proof verification and profile update:
if (address(kycSBT) != address(0)) {
    string memory ensName = string(abi.encodePacked(
        profiles[msg.sender].username, ".nexash"
    ));
    try kycSBT.setKyc(msg.sender, kycLevel, 1, ensName) {} catch {}
}
```

The `try/catch` ensures that if SBT minting fails for any reason (e.g., the user already has an SBT), the ZK verification still succeeds. The SBT is a bonus feature, not a critical path.

The resulting SBT has:
- `level` = the KYC level from the ZK proof (e.g. 2 = Intermediate)
- `status` = 1 (Active)
- `ensName` = `username.nexash` (e.g. "zaid.nexash")
- `createTime` = block.timestamp of verification

---

## Ownership Transfer

During registry deployment, `MockKycSBT` ownership is transferred to `NexashUserRegistry`:

```solidity
// DeployRegistries.s.sol
MockKycSBT(kycSBT).transferOwnership(address(userRegistry));
```

This is necessary because `setKyc` is `onlyOwner`. The registry becomes the sole entity that can mint KYC SBTs — ensuring SBTs are only issued after a valid ZK proof has been verified on-chain.

---

## Deployed Addresses

| Contract | Address |
|---|---|
| MockKycSBT | `0x197CB6cAD5E0C67446E89E082e18b9300C14B367` |
| KYCGate | `0xF1e9A324D7E0915DcE873BE044E50ebE5b5cAa61` |

---

## IKycSBT Interface

The full interface implemented by `MockKycSBT`:

```solidity
interface IKycSBT {
    enum KycLevel  { None, Basic, Intermediate, Advanced, Premium }
    enum KycStatus { None, Active, Suspended }

    function setKyc(address, uint8, uint8, string calldata) external;
    function getKycLevel(address) external view returns (uint8);
    function getKycStatus(address) external view returns (uint8);
    function meetsKycLevel(address, uint8) external view returns (bool);
    function getEnsName(address) external view returns (string memory);
    function getCreateTime(address) external view returns (uint256);
}
```
