# Phase 2 — Mainnet Launch

**Status: UPCOMING**
**Target: Q3–Q4 2025**
**Network: HashKey Chain Mainnet (Chain ID: 177)**

---

## Overview

Phase 2 moves Nexash to HashKey Chain Mainnet with production-grade security, audited contracts, and real USDC/USDT flows. The focus is on hardening every component for real institutional use — audit, security, UX polish, and performance.

---

## Smart Contract Audit

Before mainnet deployment, all contracts undergo a professional security audit covering:

- ZKTreasury payment execution logic
- Nullifier storage and replay prevention
- Policy enforcement edge cases
- Registry access controls
- Reentrancy and integer overflow
- ZK proof verification correctness

Target auditors: firms with experience in ZK protocol audits (Spearbit, Trail of Bits, or equivalent).

---

## Performance Improvements

### Proof Generation

Current proof generation time is 45-60 seconds in browser. Phase 2 targets:

- **WASM optimization** — Upgrade to latest Barretenberg WASM with SIMD support
- **Recursive proofs** — Aggregate identity + policy into a single proof submission
- **Proof caching** — Cache the identity proof and reuse across multiple payments to the same treasury (within the nullifier validity window)

Target: sub-30 second proof generation for most devices.

### Gas Optimization

- Batch nullifier storage
- Optimize public input encoding
- Reduce calldata size for proof submission

---

## Production NexaID Integration

Move from TransGate extension dependency to NexaID's production API:

- Server-side zkTLS attestation option (for institutions that control both parties)
- Mobile-compatible attestation flow
- Multiple KYC providers beyond Binance (where NexaID supports them)

---

## Jurisdiction Configuration

Replace the testnet "open" jurisdiction allowlist with real configuration:

- Per-treasury jurisdiction Merkle tree configuration
- UI for institution admins to configure allowed countries
- OFAC/sanctions list integration (Merkle tree of blocked jurisdictions)
- Jurisdiction update governance (timelock for policy changes)

---

## Multisig Support

Full implementation of the multisig threshold feature:

- M-of-N payment approval UI
- Pending payment queue management
- Approval notifications
- Timeout and cancellation handling

---

## Production HSP Integration

- Live merchant account with HashKey Pay
- Real USDC/USDT flows on HashKey Chain Mainnet
- Payment receipt generation
- Settlement reporting for institutional accounting

---

## Token Expansion

Add support for all HSP-approved tokens on HashKey Chain Mainnet:

| Token | Contract | Protocol |
|---|---|---|
| USDC | `0x054ed45810DbBAb8B27668922D110669c9D88D0a` | EIP-3009 |
| USDT | `0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029` | Permit2 |
| HSK | Native | Permit2 |

---

## Deliverables

- [ ] Smart contract audit report published
- [ ] Mainnet deployment of all contracts
- [ ] Production NexaID integration
- [ ] Sub-30s proof generation
- [ ] Jurisdiction configuration UI
- [ ] Multisig payment queue
- [ ] Production HSP integration
- [ ] Mobile-compatible verification flow
- [ ] Security bug bounty program launched
- [ ] Comprehensive documentation site
