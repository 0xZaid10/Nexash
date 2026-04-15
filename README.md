# Nexash — ZK-Gated Institutional Treasury

**Compliance you can prove. Privacy you never lose.**

Nexash is an institutional treasury and payment system built on HashKey Chain that enables:

- ✅ KYC-verified payments  
- ✅ Zero identity exposure  
- ✅ On-chain compliance enforcement  
- ✅ Audit-ready financial records  

---

## 🔗 Built on HashKey Ecosystem (End-to-End)

Nexash is not a standalone prototype — it is built using core HashKey ecosystem primitives, fully integrated:

### 🟣 NexaID (zkTLS Identity Layer)
- Real KYC verification via Binance  
- zkTLS attestation generation  
- On-chain anchoring via:
  - taskId  
  - reportTxHash  
- Used directly in ZK proof generation  

👉 This ensures:  
**Identity is real, verifiable, and privacy-preserving**

---

### 🟢 HSP (HashKey Settlement Protocol)
- Structured payment mandates  
- HMAC + JWT authenticated requests  
- Canonical JSON hashing  
- Full payment lifecycle tracking  

👉 This ensures:  
**Payments are standardized, auditable, and production-ready**

---

### 🔵 Smart Contract Layer (HashKey Chain)
- ZK proof verification  
- Policy enforcement  
- Treasury execution  

👉 This ensures:  
**Compliance is enforced by code, not trust**

---

## 🚨 Why Nexash Exists

Institutions face a fundamental contradiction:

### They need compliance:
- KYC / AML enforcement  
- Auditability  
- Risk control  

### But they also need privacy:
- No exposure of user identity  
- No permanent public data leaks  
- No centralized data storage  

---

## ❌ Existing systems fail

| System | Problem |
|------|--------|
| Banks | Slow, expensive, no programmability |
| DeFi | No compliance guarantees |
| Wallets | No governance or controls |
| KYC tools | Expose sensitive data |

---

## 💡 Nexash solves this

**Compliance is proven, not revealed**

Instead of exposing identity, Nexash uses:

- zkTLS attestations (NexaID)  
- Zero-Knowledge proofs (Noir)  

To answer one question:

> **Is this user allowed to receive funds?**

Without ever revealing:
- who they are  
- where they are  
- what their data is  

---

## ⚙️ How It Works

### End-to-End Flow

User → NexaID KYC → zkTLS Attestation → ZK Proof → Smart Contract → Payment → Audit Log

---

### Step-by-Step

1. User completes KYC (Binance via NexaID)  
2. NexaID generates attestation:
   - taskId  
   - reportTxHash  
3. User generates Zero-Knowledge proof (Noir)  
4. Smart contract verifies:
   - Identity compliance  
   - Policy rules  
   - Treasury permissions  
5. HSP processes structured payment  
6. Payment executes  
7. Audit record is created  

---

## 🧬 Architecture (DVC Model)

### 1️⃣ Data — NexaID (zkTLS)
- Real-world KYC verification  
- Trusted attestation layer  

### 2️⃣ Verification — ZK Proofs
- Proves:
  - KYC validity  
  - KYC level  
  - Jurisdiction compliance  
- No identity exposure  

### 3️⃣ Control — Smart Contracts
- Enforces:
  - Roles  
  - Policies  
  - Proof validity  
- Executes payments  

---

## 🔐 Core Features

### 🟣 ZK Identity (NexaID)
- zkTLS-based verification  
- Proof-based eligibility  
- No personal data exposure  

### 🟢 Policy Engine
- Spending limits  
- Daily limits  
- Jurisdiction filters  
- KYC level enforcement  

### 🔵 HSP Payment System
- Structured mandates  
- Signed requests  
- Payment lifecycle tracking  

### 🟠 Multi-Signature Treasury
- Role-based access:
  - Admin  
  - Operator  
  - Viewer  
- Threshold approvals  

### 🟡 Audit Trail
- Fully on-chain  
- Tamper-proof  
- Exportable  

---

## 🧱 Deployed Contracts

### Core Treasury
```
ZK Treasury        : 0x1F9C1F8b84F05275e71B65009eEED42b7E867417
Treasury Factory   : 0xe8D4e916267EE3C0583B2412e196970b1EB211ea
Policy Engine      : 0xB5bAfD9b15dF96164f1da04a189CFf6156782aC3
KYC Gate           : 0x8ad7363862C9ff1E5D53b05bC3ac57F69Bf51c25
HSP Adapter        : 0xb578a39388c5185929c3a9E5A62e40482636aC67
```

### ZK Verifiers
```
Identity Verifier  : 0x4089449207d346cDeDc4fE7Eb2237D2Bd80b82De
Policy Verifier    : 0x73D360fAC06136AFb6BCAD0e08863383FAc8CB89
```

### Identity & Registry
```
User Registry      : 0x89e19f51D0B4CA61d2C62B77C238b34B50F202aD
Org Registry       : 0x9e4a56A8CafaC3Bf0508991a5438F8BcCD5eF1F0
Mock KYC SBT       : 0x175cE48DDE8F0EDC7C1D0D28328Ad4DCB942CDC9
```

### Tokens
```
USDC.e             : 0x18Ec8e93627c893ae61ae0491c1C98769FD4Dfa2
USDC               : 0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6
USDT               : 0x372325443233fEbaC1F6998aC750276468c83CC6
```

---

## 🌐 Network

```
Chain ID     : 133
RPC          : https://testnet.hsk.xyz
Explorer     : https://testnet-explorer.hsk.xyz
```

---

## 🔑 NexaID Integration

```
Template ID  : 716efc19-807e-4c6a-a2fe-674cd634a938
App ID       : 0x7f23136ddf7a80829ad41fa76b3b22f683381b7e
Schema ID    : 0x3c5336dad721f6e2eae0000ac479638d4a44b275
```

---

## 🎯 Use Cases

- Institutional treasury management  
- Compliant payment systems  
- Contractor / payroll payouts  
- RWA investor gating  

---

## 🚀 What Makes Nexash Different

- First system combining:
  - zkTLS identity  
  - ZK proofs  
  - policy enforcement  
  - structured payments  

- Compliance enforced on-chain  
- Privacy preserved cryptographically  
- Payments structured for real-world use  

---

## ⚠️ Limitations

- ZK proof cost  
- Gas overhead  
- Early-stage prototype  
- Limited failure handling  

---

## 🧠 Core Idea

**Nexash converts private identity into a verifiable on-chain permission to move money.**
