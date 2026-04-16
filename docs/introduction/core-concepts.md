# Core Concepts

Understanding Nexash requires familiarity with a few key ideas. This page explains each concept clearly, from the basics to the technical details.

---

## Zero-Knowledge Proofs

A zero-knowledge proof (ZK proof) is a cryptographic method that lets one party (the prover) convince another party (the verifier) that a statement is true — without revealing anything beyond the truth of the statement itself.

**Simple analogy:** Imagine proving you know the answer to a puzzle without revealing the answer. The verifier can become completely convinced you know it, but learns nothing about what the answer actually is.

In Nexash, ZK proofs are used to prove:
- "This recipient has KYC level ≥ 2" — without revealing their actual KYC level, identity, or any personal data
- "This payment is within the treasury's spending limit" — without revealing the treasury's full transaction history

### UltraHonk

Nexash uses **UltraHonk**, a proving system developed by Aztec Labs as part of the Barretenberg cryptography library. UltraHonk is particularly suited for Nexash because:

- It generates compact proofs that are cheap to verify on-chain
- It supports complex arithmetic circuits (like SHA-256 and Pedersen hash)
- Proofs can be generated in a browser without a trusted setup ceremony
- The Solidity verifier contracts it produces are gas-efficient

---

## zkTLS

zkTLS is a technique that proves the content of an HTTPS response without revealing the raw data. It works by running the TLS handshake inside a trusted execution environment (TEE) and generating a cryptographic proof that the response came from the specified server and contained the specified fields.

**Why it matters for Nexash:** KYC data sits behind authenticated APIs (like Binance). zkTLS lets NexaID prove "this user's Binance account has KYC status = verified, level = Intermediate" without Nexash ever seeing the user's Binance credentials, user ID, or personal data.

---

## Nullifiers

A nullifier is a one-way commitment that prevents a ZK proof from being used more than once without revealing who used it.

In Nexash, each identity proof generates a nullifier computed as:

```
nullifier = pedersen_hash(nullifier_secret, treasury_address)
```

The nullifier is stored on-chain after the first use. If the same proof is submitted again, the contract checks the nullifier and rejects the duplicate. But because the nullifier is a hash of a secret the user controls, the chain cannot link nullifiers across different treasuries or trace which user generated which nullifier.

---

## Pedersen Hash

Pedersen hash is a hash function that is efficient inside ZK circuits. Unlike SHA-256, which requires many arithmetic operations inside a ZK circuit, Pedersen hash uses elliptic curve operations that are natively efficient in the BN254 field used by Noir and Barretenberg.

Nexash uses Pedersen hash for:
- Computing nullifiers
- Computing the KYC data commitment that binds a proof to specific attested values
- Computing the Merkle root of the jurisdiction allowlist
- Computing the policy hash that binds a treasury's policy to its ZK proofs

---

## The BN254 Field

Noir circuits operate over the BN254 scalar field, which has a modulus of approximately 2^254. This means all field elements must be less than:

```
21888242871839275222246405745257275088548364400416034343698204186575808495617
```

When Nexash converts 256-bit values (like Ethereum transaction hashes) to field elements, it takes the value modulo this field modulus. This is why `reportTxHash` values are reduced before being passed to the circuit.

---

## DVC Pattern

DVC stands for Data Verification and Computation. It is an architectural pattern for building privacy-preserving applications on top of zkTLS attestations.

The pattern separates two concerns:
1. **Data Verification** — proving that a piece of data came from a trusted source (handled by NexaID zkTLS)
2. **Computation** — proving that some computation over that data satisfies a condition (handled by Nexash's Noir circuits)

This separation is powerful because it means Nexash does not need to trust NexaID's attestor key. The `reportTxHash` on HashKey Chain is the anchor — if the tx exists and was confirmed, the attestation happened. The ZK circuit proves compliance over the attested data.

---

## Soul-Bound Tokens (SBT)

A soul-bound token is a non-transferable NFT that represents an identity attribute. HashKey Chain supports KYC SBTs as a standard for on-chain identity.

Nexash integrates with `MockKycSBT` — when a user completes ZK identity verification, `NexashUserRegistry` automatically calls `MockKycSBT.setKyc()` to mint an SBT representing their verified KYC status. This bridges Nexash's ZK-based verification with HashKey's native SBT standard.

---

## Trusted Execution Environment (TEE)

A TEE is a secure area of a processor that guarantees code executes correctly and data remains confidential, even from the operating system or hardware owner.

Phala Network's TEE infrastructure powers NexaID's attestation nodes. The attestor's private key is generated inside the TEE and never exported. Signing operations can only happen inside the TEE after the zkTLS protocol completes successfully. This makes the attestation trustworthy without requiring trust in Phala or NexaID as organizations.
