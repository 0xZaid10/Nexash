# Welcome to Nexash

## Private Compliance for On-Chain Institutional Finance

Nexash is a zero-knowledge gated institutional treasury and payment system built on HashKey Chain. It solves the fundamental tension between regulatory compliance and financial privacy in institutional blockchain payments.

---

## The Problem We Solve

When a company wants to pay a contractor or partner on-chain, they face an impossible choice:

**Option A — Skip KYC verification**
Fast and simple, but the institution has no way to prove it vetted who it paid. Regulatory exposure. Audit liability. Not acceptable for real businesses.

**Option B — Store KYC data on-chain**
Verification happens, but the recipient's identity — name, country, KYC tier, user ID — is permanently inscribed on a public blockchain. Immutable. Searchable. A privacy catastrophe.

**Option C — Use a centralized KYC oracle**
Better, but now you're trusting a third-party service to tell the truth. If it lies, gets hacked, or goes offline, payments break. You've just moved the single point of failure rather than eliminating it.

**Nexash — None of the above**

Nexash uses zero-knowledge proofs to verify compliance without revealing identity. The institution learns only one thing: *this recipient meets our KYC requirements.* Nothing else. No name. No country. No user ID. Just a cryptographic proof that the recipient is compliant.

---

## How It Works in One Paragraph

A recipient proves their KYC status once using NexaID's zkTLS attestation — which cryptographically verifies their Binance KYC without the data ever leaving a Phala trusted execution environment. This attestation is anchored on HashKey Chain. Nexash's Noir ZK circuit then generates an UltraHonk proof in the recipient's browser, proving they meet compliance requirements. This proof is stored on-chain. When an institution initiates a payment, Nexash automatically looks up the recipient's proof, generates a policy compliance proof, verifies both on-chain, and executes the payment. The entire flow is trustless, private, and fully on-chain verifiable.

---

## Key Properties

| Property | What It Means |
|---|---|
| **Zero-knowledge** | Recipient identity never revealed to institution or chain |
| **Trustless** | No oracle, no third party — proofs verified by math on HashKey Chain |
| **Composable** | Any protocol can integrate Nexash's ZK compliance layer |
| **Auditable** | Full payment history on-chain, ZK proof hashes permanently recorded |
| **Privacy-preserving** | Nullifiers prevent linking payments to identities |
| **Non-custodial** | Institutions hold their own treasury keys |

---

## Who Is Nexash For?

**Institutions** — Companies, DAOs, protocols, and funds that need to make compliant on-chain payments to multiple recipients without managing KYC data themselves.

**Individuals** — Contractors, freelancers, and partners who want to receive institutional payments without surrendering privacy.

**Developers** — Protocols that need a plug-and-play KYC compliance layer for their payment flows.

---

## Quick Links

- [Quick Start →](introduction/quick-start.md)
- [Architecture Overview →](architecture/overview.md)
- [Live Demo →](https://nexash-frontend.vercel.app)
- [Deployed Contracts →](contracts/deployed-addresses.md)
