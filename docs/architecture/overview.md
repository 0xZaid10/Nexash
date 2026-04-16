# System Overview

Nexash is composed of four layers that work together to enable private, compliant institutional payments.

---

## The Four Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│           Next.js Frontend · Privy · viem                    │
├─────────────────────────────────────────────────────────────┤
│                   ATTESTATION LAYER                          │
│         NexaID zkTLS · Phala TEE · HashKey Chain            │
├─────────────────────────────────────────────────────────────┤
│                  ZK COMPUTATION LAYER                        │
│     Noir Circuits · Barretenberg · UltraHonk Proofs         │
├─────────────────────────────────────────────────────────────┤
│                    CONTRACT LAYER                            │
│   ZKTreasury · PolicyEngine · Registries · Verifiers        │
└─────────────────────────────────────────────────────────────┘
```

### Application Layer

The frontend is a Next.js 15 application deployed on Vercel. It handles:

- Wallet connection via Privy (MetaMask, embedded wallets)
- NexaID SDK integration for triggering zkTLS attestation
- In-browser ZK proof generation via `@aztec/bb.js`
- On-chain interactions via viem
- Treasury management UI for institutions
- Payment dashboard for both individuals and institutions

### Attestation Layer

NexaID's zkTLS network runs on HashKey Chain. When a user triggers verification:

1. The frontend calls `nexaIDNetwork.submitTask()` — this sends a transaction to the NexaID task contract on HashKey Chain
2. A Phala TEE attestor node picks up the task
3. The node connects to Binance's KYC API via zkTLS, fetching KYC status without exposing credentials
4. The attestation result is recorded on HashKey Chain — the `reportTxHash`
5. The `taskId` and `reportTxHash` are returned to the frontend

This layer produces the raw attestation. It does not produce a ZK proof — that happens in the next layer.

### ZK Computation Layer

Two Noir circuits run in the user's browser:

**Identity Circuit** — Takes the NexaID attestation data as private input and produces a proof that the user meets compliance requirements. The proof is a ~2KB byte array that can be verified on-chain in a single transaction.

**Policy Circuit** — Takes the payment parameters and treasury policy as input and produces a proof that the payment is within the institution's configured limits.

Both circuits use the UltraHonk proving system via Barretenberg. Proof generation runs entirely client-side — no private data is sent to any server.

### Contract Layer

Deployed on HashKey Chain Testnet:

- `ZKTreasury` — Holds funds, verifies ZK proofs, executes payments
- `TreasuryFactory` — Deploys new ZKTreasury instances for each institution
- `PolicyEngine` — Stores and retrieves treasury spending policies
- `IdentityVerifier` — Verifies identity UltraHonk proofs on-chain
- `PolicyVerifier` — Verifies policy UltraHonk proofs on-chain
- `NexashUserRegistry` — Stores individual user profiles and KYC status
- `NexashOrgRegistry` — Stores institution profiles and treasury lists
- `KYCGate` / `MockKycSBT` — HashKey SBT standard integration
- `HSPAdapter` — HashKey Pay integration

---

## Component Interaction Map

```
User Browser
  │
  ├── NexaID SDK ──────────────────→ HashKey Chain
  │      │                                │
  │      │ reportTxHash ←─────────────────┘
  │      │
  ├── Noir Identity Circuit
  │      │ (inputs: kycLevel, jurisdiction,
  │      │  reportTxHash, taskId, nullifierSecret)
  │      │
  │      │ proof (2KB) + publicInputs
  │      ↓
  ├── viem writeContract
  │      │
  │      ↓
  │   NexashUserRegistry.verifyIdentity(proof, publicInputs, reportTxHash, taskId)
  │      │
  │      ├── IdentityVerifier.verify(proof, publicInputs) ✓
  │      ├── stores: kycLevel, reportTxHash, taskId, nullifier
  │      └── MockKycSBT.setKyc(user, level, status) ✓
  │
Institution Browser
  │
  ├── reads NexashUserRegistry.getProfile(recipientAddress)
  │      │ returns: verified=true, kycLevel=2, reportTxHash, taskId
  │      │
  ├── Noir Identity Circuit (recipient's data)
  │      │ proof + publicInputs
  │      │
  ├── Noir Policy Circuit
  │      │ proof + publicInputs
  │      │
  └── ZKTreasury.executePayment(
             token, recipient, amount, paymentReqId,
             identityProof, identityPubInputs,
             policyProof, policyPubInputs
           )
             │
             ├── IdentityVerifier.verify ✓
             ├── PolicyVerifier.verify ✓
             ├── checks nullifier not used
             ├── checks balance sufficient
             └── IERC20.transfer(recipient, amount) ✓
```

---

## Security Boundaries

**What is public (on HashKey Chain):**
- Payment amounts and recipient addresses
- ZK proof hashes (not the proofs themselves after verification)
- Nullifiers (unlinkable to identities)
- Policy parameters
- `reportTxHash` (proves NexaID attested, not what was attested)

**What is private (never leaves user's device):**
- KYC level, jurisdiction, user ID
- Nullifier secret
- Wallet binding data
- NexaID attestation details

**What is hidden by ZK:**
- The link between a nullifier and a real identity
- The exact KYC data beyond the minimum threshold
- The jurisdiction beyond membership in the allowed set
