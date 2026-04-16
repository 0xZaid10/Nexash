# Nexash — ZK-Gated Institutional Treasury & Payment System

> Private compliance for on-chain institutional finance. Built on HashKey Chain.

---

## What is Nexash?

Nexash is an institutional treasury and payment protocol that uses **zero-knowledge proofs** to verify recipient KYC compliance without exposing any identity data on-chain.

When a company pays a contractor, partner, or employee through traditional on-chain methods, they face a choice: either skip KYC verification entirely (regulatory risk) or verify on-chain and expose sensitive identity information publicly (privacy violation). Nexash eliminates this tradeoff.

**The core idea:** A recipient proves they passed KYC once. An institution verifies that proof before every payment — without ever learning who the recipient is. No identity revealed. No oracle trusted. Just cryptographic math.

---

## Why HashKey Chain?

HashKey Chain is uniquely positioned for institutional-grade DeFi:

- **Regulatory alignment** — HashKey operates under Hong Kong's regulated crypto framework, making it the natural home for compliance-focused protocols
- **NexaID integration** — NexaID's zkTLS attestation infrastructure is built on HashKey Chain, enabling native on-chain KYC attestations
- **EVM compatibility** — Full Solidity and Foundry support
- **Low fees** — Institutional payment flows require frequent on-chain operations; HashKey's fee structure makes this viable
- **HSP (HashKey Pay)** — Native stablecoin payment rails for USDC and USDT

---

## The Problem

Institutional on-chain payments require KYC verification. But putting KYC data on-chain creates three problems:

1. **Privacy** — Identity data is permanently public and immutable
2. **Compliance** — Institutions become custodians of recipient personal data
3. **Trust** — Centralized KYC oracles create single points of failure

Nexash solves all three using the **DVC pattern** (Data Verification and Computation):
- **zkTLS layer** — NexaID proves KYC happened via Binance's API, recorded on HashKey Chain
- **zkVM layer** — Noir circuit proves compliance from the attestation, verified on-chain
- **No raw data** — The chain only sees proof hashes and nullifiers

---

## Architecture

```
Individual User
      │
      ▼
NexaID zkTLS ──→ Binance KYC API (via Phala TEE)
      │
      ▼ reportTxHash (on HashKey Chain)
      │
      ▼
Noir Identity Circuit (UltraHonk)
  - Proves KYC level ≥ minimum
  - Proves jurisdiction allowed
  - Generates nullifier (prevents replay)
  - Anchors to reportTxHash (trustless)
      │
      ▼
IdentityVerifier contract ──→ NexashUserRegistry
      │                              │
      │                       stores: kycLevel,
      │                       reportTxHash, taskId
      │
Institution
      │
      ▼
TreasuryFactory ──→ ZKTreasury (per institution)
      │
      ▼
PolicyEngine ──→ spending limits, KYC requirements
      │
      ▼
Payment Request
      │
      ▼
Noir Policy Circuit (UltraHonk)
  - Proves amount ≤ spending limit
  - Proves daily limit not exceeded
  - Proves operator role
      │
      ▼
ZKTreasury.executePayment()
  - Verifies identity proof
  - Verifies policy proof
  - Checks nullifier not used
  - Transfers USDC.e to recipient
```

---

## Smart Contracts

All contracts deployed on **HashKey Chain Testnet (Chain ID: 133)**

| Contract | Address | Purpose |
|---|---|---|
| MockKycSBT | `0x197CB6cAD5E0C67446E89E082e18b9300C14B367` | On-chain KYC soul-bound token |
| KYCGate | `0xF1e9A324D7E0915DcE873BE044E50ebE5b5cAa61` | KYC verification gateway |
| PolicyEngine | `0xB5bAfD9b15dF96164f1da04a189CFf6156782aC3` | Treasury policy storage and validation |
| HSPAdapter | `0x4C742961EcF15F90308a27bda9966f16e035ED3f` | HashKey Pay integration adapter |
| ZKTreasury (demo) | `0x53518cA65C8B18A9018eE38CB925b1A5e20eeB4e` | Reference treasury implementation |
| TreasuryFactory | `0xF21e47D32Ebb35493954F23950f8B511C652d391` | Deploys new ZKTreasury instances |
| IdentityVerifier | `0x4089449207d346cDeDc4fE7Eb2237D2Bd80b82De` | UltraHonk identity proof verifier |
| PolicyVerifier | `0x73D360fAC06136AFb6BCAD0e08863383FAc8CB89` | UltraHonk policy proof verifier |
| NexashUserRegistry | `0xa17a99689b5180eE6571C7778Cf7362fA395f3EE` | Individual user profiles and KYC status |
| NexashOrgRegistry | `0xB68fBED9B78077213FCC02CA4FbA8A479ae24bF3` | Institution profiles and treasury registry |

---

## ZK Circuits

### Identity Compliance Circuit (`circuits/identity_compliance`)

Proves a recipient's KYC compliance without revealing their identity.

**Private inputs (never leave browser):**
- `kyc_level` — KYC tier (1-4)
- `jurisdiction` — ISO 3166-1 numeric country code
- `nullifier_secret` — User's secret for replay prevention
- `wallet_address` — Wallet binding
- `report_tx_hash` — NexaID's on-chain attestation tx (trustless anchor)
- `task_id` — NexaID attestation task ID
- `kyc_data_commitment` — Pedersen hash of KYC data

**Public inputs (submitted on-chain):**
- `min_kyc_level` — Minimum required KYC tier
- `allowed_jurisdictions_root` — Merkle root of allowed jurisdictions
- `nullifier` — Unique commitment preventing replay
- `treasury_address` — Binds proof to specific treasury
- `proof_timestamp` — Proof freshness
- `expiry_window` — Validity window
- `report_tx_hash_public` — Verifiable against HashKey Chain explorer

**Key design decision:** The circuit anchors trust in `reportTxHash` — a transaction hash on HashKey Chain recording NexaID's attestation. This is fully trustless: anyone can verify the tx exists and was confirmed. No attestor keypair required.

### Transaction Policy Circuit (`circuits/transaction_policy`)

Proves a payment complies with treasury policy.

**Private inputs:** spending history, operator credentials
**Public inputs:** amount, spending limit, daily limit, multisig threshold, policy hash

---

## Integrations

### NexaID zkTLS

NexaID is a zkTLS attestation protocol that proves HTTPS API responses without revealing raw data. Nexash uses it to attest Binance KYC status.

**Flow:**
1. User triggers NexaID via `@nexaid/network-js-sdk`
2. NexaID submits a `submitTask` transaction to HashKey Chain (`0x6588a24D34C881cF10c8DA77e282f6E1fBc262C7`)
3. A Phala TEE node fetches `https://www.binance.com/bapi/kyc/v2/private/certificate/user-kyc/current-kyc-status`
4. The attestation result is recorded on-chain — `reportTxHash`
5. Nexash reads `reportTxHash` and `taskId` from the attestation object
6. These are fed into the identity ZK circuit as the trust anchor

**Template used:** `716efc19-807e-4c6a-a2fe-674cd634a938` (KYC Status - Binance)

**Why this is trustless:** The attestor's private key lives inside Phala's TEE and never leaves. The `reportTxHash` is the public record of attestation — verifiable by anyone on HashKey Chain explorer without trusting NexaID's servers.

### HashKey Pay (HSP)

HSP is HashKey Chain's native payment rails. Nexash uses HSP to create structured payment mandates alongside ZK-verified transfers.

**Integration:** `lib/hsp/` — Cart mandate construction, ES256K JWT signing, HMAC-SHA256 request authentication, payment status polling.

**Supported tokens on HSK testnet:**
- USDC: `0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6`
- USDT: `0x372325443233fEbaC1F6998aC750276468c83CC6`

### OpenZeppelin

Used throughout the contract suite:

- `Ownable2Step` — Two-step ownership transfer on registries (prevents accidental ownership loss)
- `ReentrancyGuard` — Protection on all payment execution paths
- `Pausable` — Emergency pause functionality on ZKTreasury
- `IERC20` — Standard token interface for treasury deposits and payments

### Noir / Barretenberg (UltraHonk)

ZK circuits are written in [Noir](https://noir-lang.org/) and compiled with `nargo`. Proofs are generated in-browser using `@aztec/bb.js` (Barretenberg) with the UltraHonk proving system.

**Proof generation:** ~45-60 seconds in browser (no server required)
**Verification:** On-chain via exported Solidity verifier contracts

---

## How It Works — User Flows

### For Individuals (Recipients)

1. **Register** — Connect wallet, choose a username (e.g. `@zaid`), register on `NexashUserRegistry`
2. **Verify** — Click "Verify Identity". NexaID zkTLS fetches your Binance KYC. A `reportTxHash` is recorded on HashKey Chain.
3. **Prove** — Nexash generates a UltraHonk ZK proof in your browser using the attestation data. The proof is verified on-chain by `IdentityVerifier`.
4. **Receive** — Your profile is marked verified. Share `nexash/@username` to receive institutional payments.

### For Institutions

1. **Register** — Connect wallet, register your organization on `NexashOrgRegistry`
2. **Deploy Treasury** — Go through the 7-step flow: configure spending limits, KYC requirements, multisig threshold. A `ZKTreasury` contract is deployed via `TreasuryFactory`. Policy is Pedersen-hashed and stored in `PolicyEngine`.
3. **Deposit** — Send USDC.e to your treasury
4. **Pay** — Enter recipient address. Nexash auto-looks up their KYC attestation from `NexashUserRegistry`. Two UltraHonk proofs are generated and verified on-chain. Payment executes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.28, Foundry |
| ZK Circuits | Noir (UltraHonk), Barretenberg |
| Frontend | Next.js 15, TypeScript, Privy, viem |
| KYC Attestation | NexaID zkTLS (`@nexaid/network-js-sdk`) |
| Payment Rails | HashKey Pay (HSP) |
| Chain | HashKey Chain Testnet (133) |
| Deployment | Vercel |

---

## Repository Structure

```
nexash/
├── contracts/              # Solidity contracts (Foundry)
│   ├── src/
│   │   ├── ZKTreasury.sol          # Core treasury with ZK verification
│   │   ├── TreasuryFactory.sol     # Deploys ZKTreasury instances
│   │   ├── PolicyEngine.sol        # Policy storage and validation
│   │   ├── KYCGate.sol             # KYC verification gateway
│   │   ├── MockKycSBT.sol          # Soul-bound KYC token
│   │   ├── HSPAdapter.sol          # HashKey Pay adapter
│   │   ├── NexashUserRegistry.sol  # Individual user registry
│   │   └── NexashOrgRegistry.sol   # Institution registry
│   └── script/
│       ├── Deploy.s.sol            # Main deployment script
│       └── DeployRegistries.s.sol  # Registry deployment
├── circuits/               # Noir ZK circuits
│   ├── identity_compliance/        # Identity proof circuit
│   └── transaction_policy/         # Policy proof circuit
└── nexash-frontend/        # Next.js frontend
    ├── app/
    │   ├── individual/             # Recipient dashboard
    │   ├── institution/            # Institution dashboard
    │   └── onboarding/             # Registration flow
    ├── hooks/
    │   ├── useTreasury.ts          # Treasury state management
    │   ├── usePayment.ts           # Payment execution with ZK
    │   └── useRegistry.ts          # Registry interactions
    └── lib/
        ├── zk/                     # Barretenberg proof generation
        ├── nexaid/                 # NexaID SDK integration
        └── hsp/                    # HashKey Pay integration
```

---

## Live Demo

**Frontend:** https://nexash-frontend.vercel.app

**Explorer:** https://testnet-explorer.hsk.xyz

---

## License

MIT

