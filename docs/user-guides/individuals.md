# For Individuals (Recipients)

This guide walks through everything an individual needs to know to register, verify, and receive payments on Nexash.

---

## Who This Is For

You are a contractor, freelancer, consultant, employee, or any individual who wants to receive compliant institutional payments on HashKey Chain. You have a Binance account with at least Intermediate KYC verification.

---

## Prerequisites

Before starting, make sure you have:

- A wallet compatible with HashKey Chain (MetaMask recommended)
- HashKey Chain Testnet added to MetaMask
- A small amount of HSK testnet tokens for gas
- A Binance account with Intermediate KYC or above
- The NexaID TransGate Chrome extension installed

### Adding HashKey Chain Testnet to MetaMask

1. Open MetaMask → Settings → Networks → Add Network
2. Fill in:
   - Network Name: `HashKey Chain Testnet`
   - RPC URL: `https://testnet.hsk.xyz`
   - Chain ID: `133`
   - Currency Symbol: `HSK`
   - Block Explorer: `https://testnet-explorer.hsk.xyz`

---

## Step 1: Connect and Register

1. Go to [nexash-frontend.vercel.app](https://nexash-frontend.vercel.app)
2. Click **Get Started** or **Individual**
3. Connect your MetaMask wallet — make sure it is on HashKey Chain Testnet (Chain ID: 133)
4. You will be redirected to the onboarding page
5. Choose a username (3-20 characters, lowercase letters, numbers, underscores)
6. Click **Register** — this sends a transaction to `NexashUserRegistry` on HashKey Chain

Your username is permanently linked to your wallet. Choose carefully. You can update it later but the original registration is on-chain.

---

## Step 2: Verify Your Identity

This is the core of the Nexash individual flow. It has two parts: NexaID zkTLS attestation and ZK proof generation.

### Part A — NexaID Attestation

1. On your individual dashboard, click **Verify Identity**
2. The NexaID TransGate extension will open a Binance verification popup
3. Log in to Binance if prompted
4. NexaID fetches your KYC status via zkTLS — this runs inside a Phala TEE and does not expose your credentials
5. The attestation is recorded on HashKey Chain as a `reportTxHash`

> If the TransGate popup does not appear, make sure the NexaID TransGate extension is installed and enabled for the Nexash website.

### Part B — ZK Proof Generation

After the NexaID attestation succeeds:

1. Nexash reads the `reportTxHash` and `taskId` from the attestation
2. A Noir identity circuit runs in your browser using these as private inputs
3. The circuit generates an UltraHonk proof (approximately 45-60 seconds)
4. The proof is submitted on-chain to `NexashUserRegistry`

> Do not close the browser tab during proof generation. The computation runs in your browser — no data is sent to any server.

### What Gets Stored On-Chain

After successful verification, `NexashUserRegistry` stores:
- `verified: true`
- `kycLevel: 2` (Intermediate)
- `nullifier` (unique hash — cannot be linked to your identity)
- `reportTxHash` (the NexaID attestation transaction on HashKey Chain)
- `taskId` (the NexaID task identifier)

Your name, Binance user ID, exact country, and all other personal data remain off-chain.

---

## Step 3: Receive Payments

Once verified, your dashboard shows:

- **Your address** — The wallet that institutions pay to
- **Your payment link** — `nexash/@username`
- **Verification status** — KYC Level 2 verified, attestation tx hash
- **Incoming payments** — List of all payments you have received

Share your wallet address or `nexash/@username` link with any institution using Nexash. When they initiate a payment, Nexash automatically looks up your profile from `NexashUserRegistry` — they do not need to ask you for your attestation data.

---

## Understanding Your Dashboard

### Verification Badge

The verification badge shows:
- Your KYC level
- The transaction hash of your UltraHonk identity proof (on HashKey Chain)
- Your NexaID attestation hash (verifiable on HashKey Chain explorer)

### Incoming Payments

Every payment appears with:
- Transaction hash (link to HashKey Chain explorer)
- Block number
- Amount (in USDC.e or USDT)
- ZK proof status

---

## Privacy Guarantees

As a recipient, here is what various parties can and cannot see:

| Party | What they see |
|---|---|
| Institution | Your wallet address, payment amount, that you are KYC-compliant |
| HashKey Chain (public) | Nullifier, payment amount, proof hash, reportTxHash |
| Nexash | Nothing beyond what is on-chain |
| NexaID | Your Binance KYC status (temporarily, inside TEE) |
| Nobody | Your name, Binance user ID, exact KYC level, jurisdiction |

---

## Frequently Asked Questions

**Q: Do I need to reverify if I receive payments from multiple institutions?**
No. Your identity proof is stored in `NexashUserRegistry` and is automatically looked up by any institution. The nullifier prevents replay, but the registry stores your verified status permanently.

**Q: What if my Binance KYC status changes?**
Your on-chain verified status reflects your KYC at the time of verification. If your KYC status changes significantly, you may need to re-verify. Institutions can set an expiry requirement for proof freshness.

**Q: Can I see who paid me?**
Yes. The institution's treasury address is visible in the payment history. Their identity as an organization is not revealed unless they choose to make it public.

**Q: What happens if NexaID is unavailable?**
The NexaID attestation is required only once during verification. Subsequent payments do not re-trigger NexaID — they use the stored `reportTxHash` from your profile.
