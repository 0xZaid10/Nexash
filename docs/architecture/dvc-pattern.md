# The DVC Pattern

DVC — Data Verification and Computation — is the architectural pattern at the heart of Nexash. Understanding it is key to understanding why Nexash works the way it does.

---

## The Two Problems

Building a privacy-preserving KYC verification system requires solving two distinct problems:

**Problem 1: Data Authenticity**
How do you prove that a piece of data (like a KYC status) actually came from a trusted source (like Binance), without revealing the raw data?

**Problem 2: Compliance Computation**
How do you prove that some computation over that data satisfies a condition (like "KYC level ≥ 2"), without revealing the inputs to the computation?

A naive approach tries to solve both problems in one system. This creates complexity, tight coupling, and usually fails to solve either problem well. DVC separates them cleanly.

---

## Layer 1: Data Verification (NexaID zkTLS)

NexaID handles data authenticity. It proves that Binance's KYC API returned a specific response for a specific user, without revealing the user's credentials or raw data.

This is accomplished through zkTLS — the TLS handshake runs inside a Phala TEE node, and the response is attested with a cryptographic signature from the TEE's key. The attestation is recorded on HashKey Chain as a transaction: the `reportTxHash`.

**What NexaID produces:**
```json
{
  "attestor": "0x154ce2f65d15f81de926dfc91e6facd706b77441",
  "taskId": "0x78587b09...",
  "reportTxHash": "0xcd5abc60...",
  "attestation": {
    "data": "{\"kycStatus\":\"1\",\"passKycLevel\":\"INTERMEDIATE\",\"userId\":\"...\"}",
    "timestamp": 1776254480001
  }
}
```

**The trust anchor:** The `reportTxHash` is on HashKey Chain. It is publicly verifiable. It does not require trusting NexaID's servers, Phala's infrastructure, or any keypair. If the transaction exists and was confirmed, the attestation happened.

---

## Layer 2: Computation (Nexash Noir Circuits)

Nexash handles compliance computation. Given the NexaID attestation data, Nexash's Noir circuit proves that the user satisfies the compliance requirements — without revealing what those requirements revealed about the user.

**The circuit receives (private):**
- The `reportTxHash` from the attestation
- The `taskId` binding this proof to a specific attestation
- The `kycLevel` extracted from the attestation data
- The user's jurisdiction (supplied by the user)
- A nullifier secret for replay prevention

**The circuit proves (public):**
- `kycLevel ≥ min_kyc_level` (the institution's requirement)
- Jurisdiction is in the allowed Merkle tree
- Nullifier is correctly derived from the secret
- `reportTxHash` is non-zero (attestation exists)
- `report_tx_hash == report_tx_hash_public` (prover knows the actual tx)

**What this achieves:** The institution learns that the recipient meets their KYC threshold. They learn nothing about the recipient's actual KYC level, exact jurisdiction, user ID, or any other personal attribute.

---

## Why Separate the Layers?

**Trust minimization:** By anchoring to `reportTxHash` rather than an attestor keypair, Nexash does not need to trust NexaID's specific signing scheme or embed their public key in the circuit. The chain itself is the trust anchor.

**Upgradability:** If NexaID updates their attestation format, Nexash's circuits may not need to change — only the data parsing layer. The ZK circuit checks that the attestation exists on-chain, not the specifics of how it was signed.

**Composability:** Any zkTLS attestation that produces an on-chain record can serve as the data layer for a Nexash-style ZK computation layer. The pattern is not specific to NexaID or Binance.

**Auditability:** The `reportTxHash` is permanently on HashKey Chain. Anyone can verify it in the block explorer. The ZK proof is permanently verified on-chain. The combination creates an immutable compliance audit trail without exposing any personal data.

---

## Comparison with Alternative Approaches

| Approach | Privacy | Trustlessness | Auditability |
|---|---|---|---|
| Raw KYC on-chain | ❌ None | ✅ Yes | ✅ Yes |
| Centralized KYC oracle | ✅ Partial | ❌ Trusts oracle | ⚠️ Oracle-dependent |
| Attestor keypair ZK | ✅ Good | ⚠️ Trusts keypair | ✅ Yes |
| **DVC (Nexash)** | ✅ **Full** | ✅ **Trustless** | ✅ **Yes** |

The DVC pattern is the only approach that achieves all three simultaneously.
