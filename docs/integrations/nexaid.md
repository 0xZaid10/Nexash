# NexaID zkTLS — Deep Dive

NexaID is the zkTLS attestation network that forms the data verification layer of Nexash's DVC architecture. This document covers the complete technical picture: what zkTLS is, how NexaID implements it, what happens inside the Phala TEE, and how Nexash integrates every step.

---

## Part 1: What Is zkTLS?

### TLS Background

TLS (Transport Layer Security) is the encryption protocol used by every HTTPS connection. When your browser connects to `https://www.binance.com`, TLS authenticates Binance's server via its certificate, establishes an encrypted channel, and ensures data integrity — tampering is detectable.

The critical property: TLS guarantees that data came from the claimed server and was not modified in transit. But this guarantee is private — only the two parties in the TLS session know what was exchanged.

### The Problem zkTLS Solves

Imagine you want to prove to a third party that Binance's API told you "your KYC status is Intermediate." You have the data, but the third party has no way to verify it came from Binance. You could have made it up. A screenshot can be faked. A signed API response would require Binance to implement a custom signing scheme. None of these work cleanly.

zkTLS solves this by running the TLS session inside a trusted execution environment, generating a cryptographic proof that the TLS transcript occurred and was not tampered with, and allowing selective disclosure of response fields.

The result: a proof that Binance said "KYC status: Intermediate" — verifiable by anyone, without revealing the full response or the user's session credentials.

### Two Approaches to zkTLS

**MPC-TLS (Multi-Party Computation)** — The TLS session is split across multiple parties using cryptographic secret sharing. More trustless, but very high latency and computational overhead.

**Proxy-TLS (TEE-based)** — The TLS session runs through a trusted proxy inside a TEE. Lower latency and more practical, but requires trust in the TEE hardware.

NexaID uses **Proxy-TLS** (`algorithmType: "proxytls"`) for practical performance. The TEE trust is mitigated by Phala's remote attestation infrastructure.

---

## Part 2: NexaID Architecture

### Network Components

```
User Browser
    │
    │ 1. submitTask (on HashKey Chain)
    ▼
NexaID Task Contract (0x6588a24D34C881cF10c8DA77e282f6E1fBc262C7)
    │
    │ 2. Task picked up by attestor node
    ▼
Phala TEE Node (5b6006c98c2e978f58e14...)
    │
    │ 3. zkTLS session to Binance API
    ▼
Binance KYC API
    │
    │ 4. Response inside TEE
    ▼
Phala TEE Node
    │
    │ 5. Attestation recorded on HashKey Chain (reportTxHash)
    │ 6. Result returned to browser
    ▼
User Browser (reportTxHash + taskId + attestation data)
```

### The Attestor Node

Each NexaID attestor is a software process running inside a Phala TEE. The TEE generates a unique keypair at startup — the private key never leaves the TEE. The attestor's Ethereum address (`0x154ce2f65d15f81de926dfc91e6facd706b77441`) is the public key.

When the attestor node receives a task:
1. Reads task parameters from HashKey Chain
2. Establishes TLS connection to the target URL (Binance's KYC API)
3. Makes the authenticated request on behalf of the user
4. Parses the response using the template's JSON paths
5. Applies `attConditions` (hash userId, check kycStatus = "1")
6. Records the `reportTxHash` on HashKey Chain
7. Returns the attestation object to the browser

Steps 2-6 happen entirely inside the TEE.

---

## Part 3: The TransGate Extension

### What TransGate Does

The NexaID TransGate Chrome extension bridges the user's browser session with the Phala TEE:

1. Intercepts the `nexaIDNetwork.attest()` call from Nexash
2. Opens a sandboxed iframe with Binance's login page
3. Captures the user's Binance session after login
4. Forwards session credentials to the Phala TEE node via encrypted channel
5. Returns the attestation result to Nexash

### Why Extension Is Required

A regular web page cannot access another site's cookies or intercept HTTPS responses due to browser security policies. The extension runs with elevated permissions that make this possible in a controlled, auditable way.

### Localhost Limitation

TransGate only works on HTTPS origins — not `http://localhost`. This is why NexaID verification only works on the Vercel deployment, not during local development.

---

## Part 4: The Attestation Object in Detail

### Full Real Attestation from Nexash Testnet

```json
{
  "attestor": "0x154ce2f65d15f81de926dfc91e6facd706b77441",
  "taskId": "0x78587b09e1a97d7b9b957c11ed7d93dfe5d48be4292df0c60e9e838c11a628f6",
  "reportTxHash": "0xcd5abc60d347c1435764d992f27ceeb070fcd9a826b5d3d4afedb26768f26737",
  "signature": "0xebeff58b10b47cfa3eefdbf044553f87278b3db6d833818d5528bae1df96c378...",
  "attestorUrl": "5b6006c98c2e978f58e146e766040de09c459e65-18080.dstack-base-prod9.phala.network",
  "attestationTime": 1776254480001,
  "attestation": {
    "recipient": "0xD37c015359a7D45b296fdd6a1CAAEE323c6E77c0",
    "request": [{
      "url": "https://www.binance.com/bapi/kyc/v2/private/certificate/user-kyc/current-kyc-status",
      "method": "POST",
      "body": "{}"
    }],
    "data": "{\"kycStatus\":\"1\",\"passKycLevel\":\"INTERMEDIATE\",\"userId\":\"1039625720\"}",
    "timestamp": 1776254480001,
    "additionParams": "{\"algorithmType\":\"proxytls\"}"
  }
}
```

### Field Explanations

**`attestor`** — Ethereum address of the Phala TEE attestor. Public key of the TEE-generated keypair. The private key lives inside the TEE and cannot be extracted.

**`taskId`** — Unique identifier for this attestation task. Corresponds to the on-chain task submission. Used in Nexash's ZK circuit to bind the proof to a specific attestation.

**`reportTxHash`** — The single most important field for Nexash. The transaction hash of the on-chain record that the attestation occurred. Verifiable at `https://testnet-explorer.hsk.xyz/tx/0xcd5abc60...`

**`signature`** — ECDSA signature from the TEE attestor key. Nexash does not verify this — see Part 5.

**`attestation.data`** — Verified KYC fields parsed from Binance's API response. The `userId` field value here (`1039625720`) would be SHA256-hashed if `attConditions` specified `op: "SHA256"`.

**`additionParams.algorithmType: "proxytls"`** — Confirms TEE-based Proxy TLS was used.

---

## Part 5: Why Nexash Does Not Verify the Signature

The `signature` field is an ECDSA signature from the TEE attestor key. To verify it, Nexash would need the exact message format that was signed. This is undocumented.

During development, 10+ message format variations were tested — with and without EIP-191 prefix, various JSON serializations, raw bytes of different fields — and none reproduced the attestor's address from the signature.

More fundamentally: even if the signature were verifiable, it would only prove the attestation was signed by `0x154ce2f65d...`. This requires trusting that NexaID's attestor key is honest and uncompromised.

The `reportTxHash` approach is more trustless: it requires trusting only that a confirmed transaction on HashKey Chain cannot be fabricated. The chain is the trust anchor, not a keypair. This is the architectural choice that makes Nexash's DVC pattern genuinely trustless.

---

## Part 6: attConditions (zkTLS Operations)

NexaID supports data processing applied to verified fields:

### Plaintext Result — returns raw field value
```typescript
{ field: 'kycStatus', op: '=', value: '1' }
// Attestation succeeds only if kycStatus == "1"
// Returned value: "1"
```

### Hashed Result — returns SHA-256 hash
```typescript
{ field: 'userId', op: 'SHA256' }
// Returns: sha256("1039625720") — user ID never in plaintext
```

### Condition Result — returns pass/fail
```typescript
{ field: 'passKycLevel', op: '=', value: 'INTERMEDIATE' }
// Attestation fails if passKycLevel != "INTERMEDIATE"
```

**Nexash's configuration:**
```typescript
attConditions: [[
  { field: 'kycStatus',    op: '=',      value: '1'            },
  { field: 'passKycLevel', op: '=',      value: 'INTERMEDIATE' },
  { field: 'userId',       op: 'SHA256'                        },
]]
```

This proves the user has verified KYC at Intermediate level or above, and binds the proof to a specific (hashed) user ID — without revealing any plaintext personal data in the attestation.

---

## Part 7: Full SDK Integration

### Initialization

```typescript
// lib/nexaid/client.ts

const TEMPLATE_ID = '716efc19-807e-4c6a-a2fe-674cd634a938'
const CHAIN_ID    = 133  // HashKey Chain Testnet

export async function runNexaIDAttestation(
  walletAddress: string,
  provider: unknown,
  onStep?: (step: string) => void
): Promise<NexaIDAttestation> {
  const { NexaIDNetwork } = await import('@nexaid/network-js-sdk')
  const nexaIDNetwork = new NexaIDNetwork()

  // Ensure wallet is on HashKey Chain before NexaID init
  const rawProvider = provider as { request: Function }
  const currentChain = await rawProvider.request({ method: 'eth_chainId' })
  if (currentChain !== '0x85') {
    await rawProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x85' }],
    })
  }

  await nexaIDNetwork.init(provider, CHAIN_ID)
  // ...
```

### Task Submission

```typescript
  const submitTaskResult = await nexaIDNetwork.submitTask({
    templateId: TEMPLATE_ID,
    address:    walletAddress,
  })
  // Returns: {
  //   taskId: "0x78587b09...",
  //   taskTxHash: "0x792ec7be...",
  //   taskAttestors: ["0x154ce2f6..."],
  //   submittedAt: 1776244922
  // }
```

### Attestation

```typescript
  const attestResults = await (nexaIDNetwork.attest as Function)({
    templateId:    TEMPLATE_ID,
    address:       walletAddress,
    taskId:        submitTaskResult.taskId,
    taskTxHash:    submitTaskResult.taskTxHash,
    taskAttestors: submitTaskResult.taskAttestors,
    attConditions: ([[
      { field: 'kycStatus',    op: '=' as const,      value: '1'            },
      { field: 'passKycLevel', op: '=' as const,      value: 'INTERMEDIATE' },
      { field: 'userId',       op: 'SHA256' as const                        },
    ]] as unknown) as never,
  })
```

The `as Function` and `as never` casts work around TypeScript errors in the NexaID SDK where `AttConditions = AttCondition[] = AttSubCondition[][]` conflicts with the generic `attest()` signature.

### Parsing the Result

```typescript
  const attestation = attestResults[0] as NexaIDAttestation
  const data = JSON.parse(attestation.attestation.data)

  return {
    ...attestation,
    reportTxHash:    attestation.reportTxHash,
    taskId:          attestation.taskId,
  }
```

### Building ZK Circuit Inputs

```typescript
// lib/zk/identity.ts

const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n

const toBigInt = (val: string): bigint => {
  if (!val || val === '0x' + '0'.repeat(64)) return 0n
  return val.startsWith('0x') ? BigInt(val) : BigInt('0x' + val)
}

// 256-bit hashes must be reduced to fit in BN254 field (~254 bits)
const reportTxHashField = (toBigInt(reportTxHash) % FIELD_MODULUS).toString()
const taskIdField        = (toBigInt(taskId)       % FIELD_MODULUS).toString()
```

---

## Part 8: The SDK Patch

The NexaID SDK's internal viem `createWalletClient` does not pass a `chain` parameter:

```javascript
// Inside @nexaid/network-js-sdk/dist/index-DiCqXokS.mjs (before patch)
walletClient: Zm({
  transport: Ps(n)  // No chain!
})
```

This causes viem to throw "No chain was provided" when `submitTask` tries to send a transaction.

**The patch** (`scripts/patch-nexaid.mjs`) runs on every `npm install` via `postinstall`:

```javascript
const CHAIN = `{
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.hsk.xyz"] },
    public:  { http: ["https://testnet.hsk.xyz"] }
  }
}`

// Regex to match both patched and unpatched versions
const walletPattern = /walletClient:\s*Zm\(\{\s*(?:chain:[^}]+,\s*)?transport:\s*Ps\(n\)\s*\}\)/

patched.replace(walletPattern, `walletClient: Zm({ chain: ${CHAIN}, transport: Ps(n) })`)
```

The regex is idempotent — it matches the already-patched version (which has `chain: ...`) and replaces it with the current chain config, ensuring the patch always reflects the latest configuration.

---

## Part 9: Error Reference

| Error | Cause | Resolution |
|---|---|---|
| "Not support mobile for now" | TransGate extension not available on mobile | Use desktop Chrome |
| "No chain was provided" | SDK patch failed | Check `postinstall` script ran successfully |
| `result: false` in attestation | Binance KYC conditions not met, or user not logged in | Ensure Binance account has Intermediate KYC |
| "SendTransaction error {}" | Gas insufficient or wrong chain | Check HSK balance and chain (133) |
| `Value exceeds field modulus` | 256-bit hash not reduced mod BN254 | Apply `% FIELD_MODULUS` before passing to circuit |
| TransGate popup does not appear | Extension not installed or not enabled | Install TransGate, enable for nexash-frontend.vercel.app |

---

## Part 10: Template Configuration

**Template ID:** `716efc19-807e-4c6a-a2fe-674cd634a938`

| Parameter | Value |
|---|---|
| Target URL | `https://www.binance.com/bapi/kyc/v2/private/certificate/user-kyc/current-kyc-status` |
| HTTP Method | POST |
| Request body | `{}` |
| Field: kycStatus | JSON path: `$.data.kycStatus` |
| Field: passKycLevel | JSON path: `$.data.passKycLevel` |
| Field: userId | JSON path: `$.data.userId` |
| App ID | `0x7f23136ddf7a80829ad41fa76b3b22f683381b7e` |
| Schema ID | `0x3c5336dad721f6e2eae0000ac479638d4a44b275` |
| Network | HashKey Chain Testnet (133) |
