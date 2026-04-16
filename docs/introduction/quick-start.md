# Quick Start

Get up and running with Nexash in minutes. This guide covers the two main user journeys: individual recipients and institutions.

---

## For Individuals (Recipients)

You are a contractor, freelancer, or partner who wants to receive ZK-verified payments from institutions.

### Step 1 — Connect Your Wallet

Go to [nexash-frontend.vercel.app](https://nexash-frontend.vercel.app) and click **Get Started**. Connect using MetaMask or any EVM-compatible wallet. Make sure your wallet is on **HashKey Chain Testnet (Chain ID: 133)**.

> **RPC Details**
> Network: HashKey Chain Testnet
> Chain ID: 133
> RPC URL: https://testnet.hsk.xyz
> Explorer: https://testnet-explorer.hsk.xyz

### Step 2 — Register Your Username

Choose a unique username (3-20 characters, lowercase letters, numbers, underscores). This becomes your payment handle: `nexash/@username`. The username is registered on `NexashUserRegistry` on HashKey Chain.

### Step 3 — Verify Your Identity

Click **Verify Identity** on your dashboard. This triggers the NexaID zkTLS flow:

1. The NexaID SDK submits a task on HashKey Chain
2. A Phala TEE node connects to Binance's KYC API via zkTLS
3. The attestation result is recorded on HashKey Chain as a `reportTxHash`
4. Nexash reads this attestation and generates a UltraHonk ZK proof in your browser

> The proof generation takes approximately 45-60 seconds. Your browser does all the computation. No data is sent to any server.

### Step 4 — Share Your Link

Once verified, your dashboard shows `nexash/@username`. Share this with any institution using Nexash to receive payments. They enter your wallet address, Nexash looks up your verified profile automatically, and the payment flows through ZK verification.

---

## For Institutions

You are a company, DAO, or fund that wants to make compliant on-chain payments.

### Step 1 — Register Your Organization

Connect your institutional wallet and go to the **Institution** tab. Register your organization name. This creates a profile on `NexashOrgRegistry`.

### Step 2 — Deploy a Treasury

Click **Deploy Treasury** and configure your spending policy:

| Parameter | Description | Example |
|---|---|---|
| Treasury name | Display name | "Engineering Payroll" |
| Per-transaction limit | Max single payment | 10,000 USDC.e |
| Daily spending limit | Max across all operators | 50,000 USDC.e |
| Minimum KYC level | 1=Basic, 2=Intermediate, 3=Advanced | 2 (Intermediate) |
| Multisig threshold | How many approvals required | 1 (single sig) |
| Min operator role | Who can initiate payments | 2 (Operator) |

The policy is Pedersen-hashed and stored on-chain in `PolicyEngine`. Your treasury is deployed via `TreasuryFactory`.

### Step 3 — Deposit Funds

Click **Deposit** and send USDC.e to your treasury address. The treasury holds funds in a smart contract you control.

### Step 4 — Make a Payment

Click **New Payment**. Enter the recipient's wallet address. Nexash automatically:

1. Looks up their verified profile from `NexashUserRegistry`
2. Retrieves their `reportTxHash` and `taskId` from the registry
3. Generates an identity proof and policy proof in-browser
4. Submits both proofs for on-chain verification
5. Executes the USDC.e transfer to the recipient

The full payment history is visible in your treasury dashboard.

---

## Requirements

- MetaMask or compatible EVM wallet
- HashKey Chain Testnet configured
- For NexaID verification: NexaID TransGate Chrome extension installed
- For testnet: HSK testnet tokens for gas (available from HashKey faucet)
