# Phase 1 — Testnet Foundation

**Status: COMPLETE ✅**
**Timeline: Q1–Q2 2025**
**Network: HashKey Chain Testnet (Chain ID: 133)**

---

## Overview

Phase 1 establishes the complete technical foundation of Nexash. Every core component is built, tested, and deployed on HashKey Chain Testnet. The goal is to prove the architecture works end-to-end — from NexaID zkTLS attestation through in-browser ZK proof generation to on-chain verification and payment execution.

---

## Delivered

### Smart Contract Suite

All ten core contracts deployed and verified on HashKey Chain Testnet:

- ✅ `ZKTreasury` — Core treasury with dual ZK proof verification
- ✅ `TreasuryFactory` — Deploys ZKTreasury instances per institution
- ✅ `PolicyEngine` — Stores and validates treasury spending policies
- ✅ `IdentityVerifier` — UltraHonk verifier for identity proofs
- ✅ `PolicyVerifier` — UltraHonk verifier for policy proofs
- ✅ `NexashUserRegistry` — Individual user profiles with ZK-verified KYC status
- ✅ `NexashOrgRegistry` — Institution profiles and treasury registry
- ✅ `KYCGate` — KYC verification gateway
- ✅ `MockKycSBT` — HashKey KYC soul-bound token integration
- ✅ `HSPAdapter` — HashKey Pay integration adapter

### ZK Circuits

- ✅ Identity compliance circuit (Noir, UltraHonk)
  - NexaID reportTxHash as trustless anchor
  - Jurisdiction Merkle tree membership
  - Nullifier derivation and binding
  - KYC data commitment
- ✅ Transaction policy circuit (Noir, UltraHonk)
  - Spending limit enforcement
  - Daily limit tracking
  - Operator role validation
  - Policy hash binding

### NexaID Integration

- ✅ `@nexaid/network-js-sdk` integration
- ✅ TransGate extension flow (HTTPS deployments)
- ✅ Phala TEE attestation → reportTxHash → ZK circuit pipeline
- ✅ SDK chain patch for HashKey Chain (133)
- ✅ Real Binance KYC attestations verified on testnet

### HashKey Pay Integration

- ✅ Cart mandate construction (RFC 8785 Canonical JSON)
- ✅ ES256K JWT merchant authorization
- ✅ HMAC-SHA256 request signing
- ✅ Payment status polling with terminal state handling
- ✅ USDC and USDT on HashKey testnet

### Frontend

- ✅ Next.js 15 application deployed on Vercel
- ✅ Privy wallet integration (MetaMask, embedded wallets)
- ✅ Individual dashboard: registration, NexaID verification, payment history
- ✅ Institution dashboard: treasury deployment, policy management, payment execution
- ✅ Auto-lookup of recipient KYC from registry (no manual entry)
- ✅ In-browser UltraHonk proof generation (~60 seconds)
- ✅ ZK proof flow console logging

### End-to-End Flow

- ✅ Individual registers → NexaID attests → ZK proof → on-chain verified
- ✅ Institution deploys treasury → sets policy → deposits → pays recipient
- ✅ Payment dashboard shows history for both parties
- ✅ Nullifier prevents proof replay across treasuries

---

## Known Limitations (To Be Addressed in Phase 2)

- NexaID TransGate extension required (browser extension dependency)
- Jurisdiction list hardcoded (open for testnet)
- Proof generation takes 45-60 seconds (browser limitation)
- Single chain only (HashKey Chain Testnet)
- Mock HSP integration for some payment flows
- No mobile support for NexaID verification
