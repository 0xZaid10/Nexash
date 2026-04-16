# Deployed Addresses

All Nexash contracts are deployed on **HashKey Chain Testnet (Chain ID: 133)**.

Explorer: https://testnet-explorer.hsk.xyz

---

## Core Contracts

| Contract | Address | Purpose |
|---|---|---|
| ZKTreasury (demo) | `0x53518cA65C8B18A9018eE38CB925b1A5e20eeB4e` | Reference treasury for testing |
| TreasuryFactory | `0xF21e47D32Ebb35493954F23950f8B511C652d391` | Deploys ZKTreasury instances |
| PolicyEngine | `0xB5bAfD9b15dF96164f1da04a189CFf6156782aC3` | Stores treasury spending policies |
| HSPAdapter | `0x4C742961EcF15F90308a27bda9966f16e035ED3f` | HashKey Pay integration |

## ZK Verifiers

| Contract | Address | Circuit |
|---|---|---|
| IdentityVerifier | `0x4089449207d346cDeDc4fE7Eb2237D2Bd80b82De` | identity_compliance |
| PolicyVerifier | `0x73D360fAC06136AFb6BCAD0e08863383FAc8CB89` | transaction_policy |

## Registries

| Contract | Address | Purpose |
|---|---|---|
| NexashUserRegistry | `0xa17a99689b5180eE6571C7778Cf7362fA395f3EE` | Individual user profiles |
| NexashOrgRegistry | `0xB68fBED9B78077213FCC02CA4FbA8A479ae24bF3` | Institution profiles |

## KYC Infrastructure

| Contract | Address | Purpose |
|---|---|---|
| MockKycSBT | `0x197CB6cAD5E0C67446E89E082e18b9300C14B367` | HashKey KYC soul-bound token |
| KYCGate | `0xF1e9A324D7E0915DcE873BE044E50ebE5b5cAa61` | KYC verification gateway |

---

## Token Addresses (HashKey Chain Testnet)

| Token | Address | Decimals |
|---|---|---|
| USDC | `0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6` | 6 |
| USDC.e (Bridged) | `0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2` | 6 |
| USDT | `0x372325443233fEbaC1F6998aC750276468c83CC6` | 6 |

---

## NexaID Infrastructure (HashKey Chain)

| Contract | Address | Purpose |
|---|---|---|
| NexaID Task Contract | `0x6588a24D34C881cF10c8DA77e282f6E1fBc262C7` | submitTask for zkTLS attestation |

---

## Deployer

| | |
|---|---|
| Deployer Address | `0x7a5944661745d07517285eb5500D0257EBFB00E5` |
| Network | HashKey Chain Testnet |
| Deployment Tool | Foundry (forge) |

---

## Verification

All contract source code is available in the repository. To verify a contract:

```bash
# Example: verify ZKTreasury
forge verify-contract \
  0x53518cA65C8B18A9018eE38CB925b1A5e20eeB4e \
  src/ZKTreasury.sol:ZKTreasury \
  --chain-id 133 \
  --rpc-url https://testnet.hsk.xyz
```
