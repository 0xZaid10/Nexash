# Why HashKey Chain

Nexash is built exclusively on HashKey Chain. This was not an arbitrary choice — HashKey Chain is the only blockchain where Nexash's full stack makes sense.

---

## NexaID is Native to HashKey

NexaID's zkTLS attestation network runs on HashKey Chain. When a user completes NexaID verification, the attestation result — the `reportTxHash` — is a transaction on HashKey Chain. This is not a bridge, a relay, or a cross-chain message. It is a native HashKey Chain transaction.

This matters because Nexash's trust model anchors to `reportTxHash`. For that anchor to be trustless, the chain it lives on must be the same chain as the ZK verifier contracts. If the attestation were on a different chain, Nexash would need a cross-chain oracle — reintroducing the trust problem it was designed to eliminate.

By building on HashKey Chain, Nexash can verify NexaID attestations directly, without any intermediary.

---

## HashKey Pay (HSP)

HashKey Pay is HashKey Chain's native payment protocol. It provides:

- Structured payment mandates with cart semantics
- Stablecoin payment rails for USDC and USDT
- Merchant authentication via ES256K JWT and HMAC-SHA256
- Payment status tracking with terminal states

Nexash integrates HSP alongside ZK proofs, giving institutions structured payment receipts in addition to on-chain ZK verification. This dual-layer approach satisfies both blockchain-native audit requirements and traditional finance reporting standards.

---

## KYC Soul-Bound Token Standard

HashKey Chain has a native KYC SBT standard — non-transferable tokens that represent verified identity attributes. This standard is integrated into HashKey's DeFi ecosystem, meaning protocols built on HashKey can check SBT status as a condition for participation.

Nexash automatically mints a KYC SBT when a user completes ZK verification. This means Nexash-verified users can participate in any HashKey ecosystem protocol that checks SBT status — without repeating the verification process.

---

## Regulatory Alignment

HashKey Group operates under a Hong Kong Virtual Asset Service Provider (VASP) license — one of the most rigorous regulatory frameworks in the world for crypto. Building Nexash on HashKey Chain means building on infrastructure that is designed from the ground up for regulatory compliance.

For institutional users — funds, corporates, and regulated entities — the choice of chain matters. HashKey Chain's regulatory posture makes Nexash a credible compliance solution rather than a workaround.

---

## EVM Compatibility

HashKey Chain is fully EVM-compatible. This means:

- Nexash's Solidity contracts compile and deploy without modification
- Foundry works natively for testing and deployment
- Viem and ethers.js work without modification in the frontend
- OpenZeppelin contracts are fully supported
- The UltraHonk Solidity verifier — a complex contract — deploys and runs correctly

---

## Chain Parameters

| Parameter | Value |
|---|---|
| Chain ID | 133 (testnet) |
| RPC URL | https://testnet.hsk.xyz |
| Explorer | https://testnet-explorer.hsk.xyz |
| Native Token | HSK |
| Block Time | ~2 seconds |
| Consensus | PoS |
