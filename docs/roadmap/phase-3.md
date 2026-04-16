# Phase 3 — Ecosystem Expansion

**Status: PLANNED**
**Target: Q1–Q2 2026**
**Network: HashKey Chain Mainnet + Cross-chain**

---

## Overview

Phase 3 expands Nexash from a standalone product into a protocol that other applications can build on. The ZK compliance layer becomes composable infrastructure for the broader HashKey and EVM ecosystem.

---

## Nexash SDK

A developer SDK that allows any protocol to integrate Nexash's ZK compliance layer:

```typescript
import { Nexash } from '@nexash/sdk'

const nexash = new Nexash({ chain: 'hashkey-mainnet' })

// Verify a recipient is KYC-compliant before initiating a payment
const isCompliant = await nexash.verifyRecipient({
  address: recipientAddress,
  minKycLevel: 2,
  allowedJurisdictions: ['HK', 'SG', 'JP'],
})

// Generate a compliance proof for an off-chain payment
const proof = await nexash.generateComplianceProof({
  recipient: recipientAddress,
  amount: 1000n * 10n ** 6n,
  policy: treasuryPolicy,
})
```

### SDK Features

- Drop-in compliance verification for any payment flow
- Proof generation abstracted behind a simple API
- React hooks for frontend integration
- Node.js support for server-side verification

---

## Protocol Integrations

### DeFi Lending

Integrate Nexash compliance into DeFi lending protocols on HashKey Chain. Borrowers prove KYC compliance to access institutional credit lines. Lenders can set jurisdiction requirements without seeing borrower identity.

### Payroll Infrastructure

Purpose-built payroll module on top of ZKTreasury:

- Recurring payment scheduling
- Multi-currency support
- Batch payment execution with single proof
- Integration with traditional payroll APIs

### Grant Distribution

DAO treasury management for grant programs:

- Applicant KYC verification via Nexash
- Milestone-based payment release
- Compliance reporting for grant foundations
- Whistleblower protection via ZK anonymization

### Regulated DEX

Integrate Nexash into a decentralized exchange that requires KYC for large trades:

- Trading above a threshold requires Nexash identity proof
- Proof is reusable across multiple trades within validity window
- No identity information stored by the DEX

---

## Cross-Chain Identity

Expand the identity proof to work across chains via:

- **LayerZero messaging** — Bridge identity proofs from HashKey Chain to other EVM chains
- **Proof portability** — A Nexash identity proof generated on HashKey Chain can be verified on Ethereum, Polygon, or other EVM chains
- **Unified nullifier space** — Prevent identity proof reuse across chains

---

## Advanced Privacy Features

### Recursive Proofs

Aggregate multiple identity and policy proofs into a single on-chain submission. This reduces gas costs for batch payments from O(n) to O(1) proof verification.

### Private Treasury Balances

Use ZK proofs to hide treasury balances from public view while still proving solvency for specific payment amounts.

### Anonymous Credentials

Extend the identity model to support additional credentials beyond KYC:
- Proof of employment
- Proof of accredited investor status
- Proof of professional certification

---

## Deliverables

- [ ] Nexash SDK v1.0 (TypeScript, React)
- [ ] SDK documentation and examples
- [ ] First three protocol integrations live
- [ ] Cross-chain identity proof (at least two chains)
- [ ] Recursive proof aggregation
- [ ] Developer grant program launched
- [ ] Nexash governance token proposal
