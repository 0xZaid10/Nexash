<div align="center">

# Nexash

### Compliant payments. From your phone. On HashKey Chain.

[![HashKey Chain](https://img.shields.io/badge/HashKey_Chain-Mainnet_177-1D4ED8?style=flat-square)](https://hsk.blockscout.com)
[![HSP](https://img.shields.io/badge/HSP-Registered_Issuer-10B981?style=flat-square)](https://hsp-hackathon.hashkeymerchant.com/issuers)
[![Tests](https://img.shields.io/badge/Tests-135%2F135_passing-10B981?style=flat-square)](#)
[![Telegram](https://img.shields.io/badge/Telegram-@nexash__bot-2CA5E0?style=flat-square)](https://t.me/nexash_bot)

</div>

---

## What is Nexash?

Nexash bridges the gap between crypto payments and compliance infrastructure. It is a Telegram-native platform that lets anyone send KYC-verified, cryptographically-proven compliant payments on HashKey Chain — without installing a wallet extension, without opening a browser, and without any technical knowledge.

Send a message. Get a wallet. Get verified. Send a compliant payment. That is the entire user journey.

---

## The Problem

Blockchain payments are fast and borderless, but compliance is broken. There is no standard way to verify who is sending money on-chain, no enforcement that a payer is KYC-verified, and no cryptographic proof that a payment was compliant. Traditional finance has compliance but no crypto rail. Crypto has a payment rail but no compliance layer. Nothing connects the two.

Nexash is that connection.

---

## How It Works

**1. Start the bot**
Send `/start` to the Nexash Telegram bot. A wallet is created instantly and tied to your Telegram identity. No setup, no seed phrases, no browser extension needed.

**2. Get testnet funds**
Send `/faucet`. Your wallet is funded with testnet USDC from the HSP faucet automatically.

**3. Verify your identity**
Send `/kyc`. Nexash issues a KYC attestation signed by our registered issuer key and anchors it permanently on HashKey Chain mainnet. Your compliance status now lives on-chain.

**4. Send a compliant payment**
Send `/pay 10 0xRecipient`. Nexash checks your on-chain KYC status, builds a compliant HSP mandate, executes the transfer, and returns a cryptographic ACCEPT verdict with an Explorer link — all in one command.

---

## Features

**Telegram-Native Wallets**
Every user gets a wallet the moment they start the bot. Works from any phone, any country, any time.

**On-Chain KYC Compliance**
KYC attestations are issued by Nexash as a registered HSP trusted compliance issuer and stored permanently on HashKey Chain mainnet via the `AttestationRegistry` smart contract. Compliance is enforced at the contract level — not advisory, not optional.

**HSP Compliant Payments**
Every payment is a signed HSP v1 mandate with a KYC attestation. The Coordinator independently verifies both. You receive a cryptographic ACCEPT verdict and an Explorer link for every transaction.

**AI Payroll Agent**
Describe payments in plain English. The AI agent parses instructions, resolves payee addresses, and flags anomalies before anything moves.

**Live Market Intelligence**
Real-time data from HashKey Exchange with RSI, EMA (9/21/50), VWAP, and ATR across three timeframes (15m/1h/4h). The AI trading agent gives a specific multi-timeframe analysis with confidence rating.

**Paper Trading**
Simulate trades with live HashKey Exchange prices. Full portfolio tracking with live P&L per position.

---

## Telegram Commands

| Command | Description |
|---|---|
| `/start` | Create your wallet and get started |
| `/wallet` | Show your address, HSK balance, and USDC balance |
| `/faucet` | Fund your wallet with testnet USDC |
| `/kyc` | Issue a KYC attestation on HashKey Chain mainnet |
| `/pay [amount] [address]` | Send a compliant HSP payment |
| `/market [pair]` | Live market data + AI multi-timeframe analysis |
| `/trade buy [pair] [USD]` | Paper trade — buy |
| `/trade sell [pair] [USD]` | Paper trade — sell |
| `/portfolio` | Your paper portfolio with live P&L |
| `/attest [address]` | Check KYC status for any address on-chain |
| `/link` | Connect to the web dashboard |

---

## HashKey Ecosystem

| Component | Role |
|---|---|
| HashKey Chain Mainnet (177) | Smart contract deployment, attestation storage |
| HashKey Chain Testnet (133) | HSP payment execution |
| HashKey Settlement Protocol | Payment mandate + compliance verification |
| HashKey Exchange API | Live market data, prices, OHLCV |
| NexaID | zkTLS KYC evidence source *(in development)* |

---

## Smart Contracts — HashKey Chain Mainnet

| Contract | Address |
|---|---|
| AttestationRegistry | `0x093393dB86DCFAe9565dbD9Fa03332D5CB3b6362` |
| PayrollTreasury | `0x06D99B9232056034B218bCDe88753820bCdF6AC4` |
| Registered Issuer | `0xb625c4699784c6bEDabB6A83005981a7c14186D3` |

**AttestationRegistry** — The source of truth for KYC compliance. Stores signed attestations per wallet address, checked before every payment.

**PayrollTreasury** — Compliance-gated payment contract. Reads AttestationRegistry before releasing any transfer. No attestation, no payment — enforced by the contract itself.

---

## Proven Live

| Item | Value |
|---|---|
| Compliant HSP payment | [`0xaddf28bc...`](https://hsp-hackathon.hashkeymerchant.com/explorer?payment=0xaddf28bcff42219b1dbaebfc1578aadc671b5ee4a8794532fad6deb0cdd88c82) |
| KYC attestation on mainnet | [`0x5dd08dea...`](https://hsk.blockscout.com/tx/0x5dd08dea907dca6f290a42aa0797e9b4b458a5e7ce12a2e30fc154de7123ad17) |
| HSP verdict | `ACCEPT` |
| Issuer | Nexash (`0xb625c469...`) — no mock issuer |
| Tests | 135/135 passing |

---

## Roadmap

- **Frontend dashboard** (`app.nexash.xyz`) — Privy login, KYC flow, portfolio, payroll
- **NexaID integration** — real Binance KYC verification via zkTLS Chrome extension
- **Live HashKey Exchange trading** — paper trading infrastructure already built
- **Mainnet USDC.e payments** — PayrollTreasury funded for real payment releases
- **Domain + SSL** — `nexash.xyz`, `api.nexash.xyz`, `app.nexash.xyz`

---

## The Full Vision — Production Compliant Flow

This is the complete end-to-end flow once the frontend dashboard and NexaID integration are live. Every piece of infrastructure is already built — the contracts, the backend, the issuer, the HSP integration. The frontend is the final surface that connects it all for a real user.

### Frontend Dashboard (`app.nexash.xyz`) — In Development

The dashboard is a SaaS-style web app built with React + Vite + Privy. It gives users a full web interface for everything the Telegram bot does, plus the NexaID KYC verification flow that requires a browser.

**Pages:**
- **Home** — account status, wallet, KYC badge, quick stats, recent activity
- **Payroll** — natural language payment input, AI proposals, anomaly review, payee directory, payment history
- **Trading** — live HashKey Exchange market data, AI analysis panel, paper portfolio with live P&L
- **Compliance** — KYC attestation status, NexaID verification trigger, HSP payment lookup, contract info

**Login:** Privy — wallet, email, or Google. One account links to both Telegram and web via a one-time token from `/link`.

---

### NexaID Integration — In Development

NexaID is a zkTLS-based identity verification network built on HashKey Chain. It allows users to prove their real-world KYC status on-chain — without exposing personal data, without a centralized authority, and without trusting Nexash to vouch for them manually.

**What NexaID does:**
- User installs the NexaID Chrome extension
- User navigates to their Binance KYC settings page
- The extension intercepts the authenticated Binance KYC API response using zkTLS — a cryptographic proof that the data came from Binance's servers, not fabricated
- The extension captures: `kycStatus`, `userId`, `passKycLevel`
- The proof is submitted to NexaID's `taskContract` on HashKey Chain mainnet
- A TEE-secured attestor node signs the result on-chain
- User receives a `reportTxHash` — permanent on-chain proof of their KYC status

**Confirmed live on HashKey Chain mainnet (chainId 177):**
```
taskContractAddress: 0x1c5D0d5e0a3e0a5c9B0cDcF5C25A892281e4cd04
apiUrl:              https://nexaid.hashkey.com/api
templateId:          d431963d-800b-45e8-8345-532e9ea85e90
Data captured:       kycStatus, userId, passKycLevel (from Binance KYC)
```

---

### Full Production Compliant Flow

Once frontend and NexaID are live, this is the complete journey from new user to verified compliant payment:

```
ONBOARDING
──────────
1. User opens app.nexash.xyz
   Logs in with Privy (wallet / email / Google)
        │
        ▼
2. User sends /link in Telegram bot
   Receives one-time token (expires 15 min)
   Enters token on dashboard → accounts linked
   (One identity across Telegram + web)
        │
        ▼
3. User clicks "Verify KYC" on dashboard
   Prompted to install NexaID Chrome extension
        │
        ▼
4. User opens Binance KYC settings in browser
   NexaID extension intercepts the KYC API response
   zkTLS proof submitted to NexaID taskContract on mainnet
   User receives reportTxHash
        │
        ▼
5. User submits reportTxHash on dashboard
   POST /attestations/issue-kyc
        │
        ▼
6. Nexash backend:
   a. Confirms reportTxHash exists on HashKey Chain mainnet
   b. Calls NexaID API — verifies kycStatus = PASS
   c. Our registered issuer (0xb625c469) signs attests:kyc:v1[level=full]
   d. Writes attestation to AttestationRegistry on mainnet (permanent)
        │
        ▼
7. User is now KYC-verified on HashKey Chain
   Badge shows: ✅ KYC Verified — Level 3 — Expires [date]


MAKING A COMPLIANT PAYMENT
──────────────────────────
8. User sends /pay 100 0xRecipient in Telegram
   (or submits via dashboard payroll flow)
        │
        ▼
9. Backend policy check:
   AttestationRegistry.isValid(payer, KYC_CAPABILITY) → true
   ✅ Payer is KYC-attested on mainnet
        │
        ▼
10. Nexash issues fresh HSP attestation
    issueKycAttestationDirect() — signed by 0xb625c469
    capabilityId: attests:kyc:v1[level=full]
    subjectBinding: payer address
        │
        ▼
11. Build HSP v1 mandate
    requiredCapabilities: [kycFull.id role-wrapped]
    Signed by payer key
        │
        ▼
12. Register with HSP Coordinator
    POST /payments — mandate + attestation
    paymentId returned
        │
        ▼
13. On-chain ERC-20 transfer (HashKey testnet)
    Payer wallet → recipient address
    waitForTransactionReceipt (2 confirmations)
        │
        ▼
14. Observe settlement
    POST /payments/:id/observe with txHash
    Coordinator verifies: attestation trusted? ✅
                         subject matches payer? ✅
                         transfer confirmed? ✅
        │
        ▼
15. Independent verification
    hspVerifier.fetchAndVerify(paymentId) → ACCEPT
        │
        ▼
16. ✅ Payment SETTLED — ACCEPT
    User receives in Telegram:
    paymentId + txHash + Testnet Explorer + HSP Explorer

    And on dashboard:
    Payment appears in history with full compliance audit trail
```

### Why Two Compliance Layers?

Most compliance demos are advisory — they flag things but nothing is enforced. Nexash enforces compliance at two independent layers simultaneously:

```
Layer 1 — Our Contract (mainnet 177):
  AttestationRegistry.isValid() checked before every payment
  If payer is not attested → transaction blocked by backend
  If PayrollTreasury.releasePayment() called directly → reverts on-chain

Layer 2 — HSP Coordinator (testnet 133):
  Verifies our attestation cryptographically
  Checks issuer is in trusted set (Nexash registered)
  Checks subject binding matches mandate payer
  Only issues receipt on ACCEPT — no receipt, no settlement
```

Neither layer trusts the other. Both must pass. This is the architecture of a real compliance system — not a demo, not advisory, enforced at the protocol and contract level simultaneously.

### One Attestation, Two Systems

The same attestation signed by our issuer key (`0xb625c469...`) satisfies both enforcement layers:

```
Our issuer signs one attestation
        │
        ├── Submitted to HSP Coordinator
        │   HSP verifies: trusted issuer ✅ valid cap ✅ → ACCEPT
        │
        └── Written to AttestationRegistry on mainnet
            PayrollTreasury reads it before releasing USDC.e
            isValidWithMinLevel() → transfer proceeds
```

One signing key. One attestation format. Two independent systems enforcing compliance. This is what makes Nexash's architecture genuinely novel — it acts as the trust bridge between NexaID's identity proof, HSP's payment verification, and on-chain contract enforcement, all through a single registered issuer identity on HashKey Chain.

---

---

## Technical Documentation

### Architecture

```
Telegram Bot (user surface)
        │
        ▼
Nexash Backend (Node.js + Express 5 + TypeScript)
  ├── Venice AI (GLM-5.2)
  │     ├── Payroll intent parser
  │     ├── Anomaly review agent
  │     └── Multi-timeframe trading agent
  ├── HashKey Exchange API
  │     └── Live OHLCV → RSI / EMA / VWAP / ATR
  ├── HSP Integration
  │     ├── Mandate builder (v1 wire format)
  │     ├── Coordinator client
  │     └── Independent verifier
  └── Two on-chain rails
        ├── AttestationRegistry (mainnet 177) — KYC state
        └── PayrollTreasury (mainnet 177) — payment enforcement

Compliance flow:
  Mainnet (177) AttestationRegistry → policy gate
  Testnet (133) HSP Coordinator → payment settlement
```

### Compliance Flow

```
/pay [amount] [address]
        │
        ▼
1. Check AttestationRegistry (mainnet 177)
   isValid(payer, CAPABILITY_BYTES32.KYC)?
        │
        ├── NO  → "Run /kyc first" — blocked
        │
        └── YES ↓
2. issueKycAttestationDirect()
   Our issuer key (0xb625c469) signs attests:kyc:v1[level=full]
        │
        ▼
3. buildSignedMandate()
   EIP-712 mandate with requiredCapabilities = [0xe176eab8...]
   Signed by payer key
        │
        ▼
4. hspCoordinatorClient.registerMandate(mandate, [attestation])
   POST /payments to HSP Coordinator
        │
        ▼
5. On-chain ERC-20 transfer (testnet 133)
   waitForTransactionReceipt (2 confirmations)
        │
        ▼
6. hspCoordinatorClient.observePayment(paymentId, txHash)
        │
        ▼
7. hspVerifier.fetchAndVerify(paymentId)
   Independent verification → ACCEPT
        │
        ▼
✅ "Payment SETTLED — ACCEPT"
   paymentId + txHash + Blockscout + HSP Explorer
```

### Repository Structure

```
backend/
├── contracts/              Solidity — AttestationRegistry + PayrollTreasury
│   ├── src/                Contract source
│   ├── test/               Foundry tests (31/31)
│   └── script/             Deploy scripts
├── src/
│   ├── agents/
│   │   ├── paymentsAgent/  Intent parser + anomaly review
│   │   └── tradingAgent/   Market reasoning + paper portfolio
│   ├── chain/              viem clients for mainnet contracts
│   ├── config/             Env validation, chain config, HSP config
│   ├── db/                 SQLite — users, portfolios, payees, attestation log
│   ├── hsp/                HSP v1 — mandate builder, coordinator, verifier, vendor
│   ├── issuer/             KYC attestation signing, NexaID verifier
│   ├── market/             HashKey Exchange client + RSI/EMA/VWAP/ATR
│   ├── routes/             20 HTTP endpoints
│   ├── telegram/           Telegram bot — all commands
│   └── wallet/             Server-side wallet generation + faucet + HSP payment
├── test/                   135 tests across agents, chain, payees, security, vendor
└── scripts/                smoke test, HSP round trip, seed attestation
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/health/config` | — | Active chain + issuer info |
| POST | `/attestations/issue-kyc` | ✓ | Issue KYC attestation |
| GET | `/attestations/:subject` | — | Check attestation status |
| POST | `/payments/release` | ✓ | Release compliant payment |
| GET | `/payments/:paymentId` | — | Payment status |
| POST | `/institutions/payees` | ✓ | Register payee |
| GET | `/institutions/payees` | ✓ | List payees |
| GET | `/institutions/payees/:id` | ✓ | Get payee |
| GET | `/institutions/payees/:id/history` | ✓ | Payment history |
| DELETE | `/institutions/payees/:id` | ✓ | Remove payee |
| POST | `/institutions/payroll/parse` | ✓ | AI payroll parse |
| POST | `/institutions/payroll/review` | ✓ | Anomaly review |
| POST | `/trading/session` | — | Start paper session |
| POST | `/trading/ask` | — | Trading agent query |
| GET | `/trading/:userId/portfolio` | — | Portfolio + live P&L |
| POST | `/users/me` | — | Resolve Privy user |
| GET | `/users/:userId/portfolio` | — | User portfolio |
| POST | `/link` | — | Consume link token |

Auth header: `X-Nexash-Operator-Key: <key>`

### HSP Integration Details

```
Coordinator:    https://hsp-hackathon.hashkeymerchant.com
Chain:          hashkey-testnet (chainId 133)
Testnet USDC:   0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6

Capability IDs (confirmed from HSP repo source):
  attests:kyc:v1[level=full] role-wrapped (mandate):
    0xe176eab87495d286f7e5298e98297365377824ecdca366af968570f8230709c6
  attests:kyc:v1[level=full] baseId (attestation.capabilityId):
    0x232e9f37db21a178d9598188ea9294473f2f8897d058c7d382dd465e9d100469
  KYC schema ID:
    0xedc9e4b795c2d81b19fe5080310f148e7f853b18b6e8c4cb190b6ee4d2b7e541

Nexash issuer (registered in HSP trust config):
  address:    0xb625c4699784c6bEDabB6A83005981a7c14186D3
  issuerKeyId: 0xf6520f2a7b8e4e844f55cc8da9d56ab5745e853b0ee9e5e6f8c70814a82f400d
  families:   attests:kyc:v1, attests:sanctions:v1
```

### Environment Variables

```env
# Chain
ACTIVE_CHAIN=hashkey-mainnet
HSP_CHAIN=hashkey-testnet
HASHKEY_TESTNET_RPC_URL=https://testnet.hsk.xyz

# Contracts
ATTESTATION_REGISTRY_ADDRESS=0x093393dB86DCFAe9565dbD9Fa03332D5CB3b6362
PAYROLL_TREASURY_ADDRESS=0x06D99B9232056034B218bCDe88753820bCdF6AC4

# Keys
BACKEND_SIGNER_PRIVATE_KEY=0x...
NEXASH_ISSUER_PRIVATE_KEY=0x...
NEXASH_ISSUER_ADDRESS=0xb625c4699784c6bEDabB6A83005981a7c14186D3

# HSP
HSP_COORDINATOR_URL=https://hsp-hackathon.hashkeymerchant.com
HSP_API_KEY=...

# AI
VENICE_API_KEY=...
VENICE_MODEL=zai-org-glm-5-2

# Bot
TELEGRAM_BOT_TOKEN=...
NEXASH_OPERATOR_API_KEY=...

# NexaID
NEXAID_KYC_TEMPLATE_ID=d431963d-800b-45e8-8345-532e9ea85e90
```

### Running Locally

```bash
# Install
npm install

# Copy env
cp .env.example .env
# Fill in your keys

# Run
npm run dev          # backend + telegram bot
npm run test         # 135 tests
npm run smoke-test   # 7-step live integration test
npm run hsp-round-trip  # full compliant HSP payment demo
npm run seed-attestation 0xAddress  # write mock KYC to mainnet
```

### Contracts

```bash
cd contracts

# Test
forge test -v          # 31/31

# Deploy (already deployed)
forge script script/DeployAttestationRegistry.s.sol --rpc-url https://mainnet.hsk.xyz --broadcast
forge script script/DeployPayrollTreasury.s.sol --rpc-url https://mainnet.hsk.xyz --broadcast
```

### Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript |
| Framework | Express 5 |
| Database | better-sqlite3 (SQLite) |
| Blockchain | viem |
| Validation | Zod |
| AI | Venice AI — GLM-5.2 |
| Bot | node-telegram-bot-api |
| Contracts | Solidity, Foundry |
| Tests | Vitest |

---

[Telegram](https://t.me/nexash_horizon_bot) · [Website](https://nexash.xyz) · [Blockscout](https://hsk.blockscout.com/address/0x093393dB86DCFAe9565dbD9Fa03332D5CB3b6362)

</div>
