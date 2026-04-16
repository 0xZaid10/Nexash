# For Institutions

This guide covers everything an institution needs to deploy a treasury, configure policy, and make ZK-verified compliant payments on Nexash.

---

## Who This Is For

You represent a company, DAO, fund, or any organization that needs to make compliant on-chain payments to individuals. You need KYC verification of recipients but cannot or do not want to store their personal data.

---

## Prerequisites

- An institutional wallet on HashKey Chain Testnet
- HSK testnet tokens for gas
- USDC.e or USDT for treasury funding (available from HashKey testnet faucet or bridge)

---

## Step 1: Register Your Organization

1. Go to [nexash-frontend.vercel.app](https://nexash-frontend.vercel.app) and click **Institution**
2. Connect your institutional wallet
3. Click **Register Organization**
4. Enter your organization name and display name
5. Confirm the transaction — this creates your profile on `NexashOrgRegistry`

Your organization is linked to the connected wallet, which becomes your first admin.

---

## Step 2: Deploy a Treasury

Click **Deploy Treasury** and configure the following:

### Treasury Name

A display name for this treasury (e.g. "Engineering Payroll Q3", "Contractor Payments", "Grant Distribution").

### Spending Policy

| Field | Description | Recommendation |
|---|---|---|
| Per-transaction limit | Maximum amount per payment (in USDC.e, 6 decimals) | Set to your largest expected single payment |
| Daily spending limit | Maximum total across all operators per day | Set to 3-5× per-transaction limit |
| Min KYC level | Minimum recipient KYC tier (1-4) | 2 (Intermediate) for most use cases |
| Multisig threshold | Number of approvals required | 1 for single-sig, higher for large treasuries |
| Min operator role | Minimum role to initiate payments | 2 (Operator) |

### 7-Step Deployment Flow

The treasury deployment is a guided 7-step process:

1. **Configure** — Enter all policy parameters in the UI
2. **Simulate** — The frontend simulates the deployment to check for errors
3. **Deploy** — Your wallet signs the `TreasuryFactory.deployTreasury()` transaction
4. **Confirm** — Wait for the deployment transaction to be confirmed
5. **Compute policy hash** — Barretenberg computes the Pedersen hash of your policy in-browser
6. **Update policy** — Your wallet signs the `ZKTreasury.updatePolicy()` transaction
7. **Register** — The treasury is registered to your organization in `NexashOrgRegistry`

After completion, your treasury is ready to receive deposits.

---

## Step 3: Deposit Funds

On your treasury dashboard:

1. Click **Deposit**
2. Select the token (USDC.e or USDT)
3. Enter the amount
4. Approve the ERC-20 transfer (first deposit only)
5. Confirm the deposit transaction

Funds are held in your `ZKTreasury` contract. Only admins can withdraw.

---

## Step 4: Make a Payment

1. Click **New Payment** on your treasury dashboard
2. Enter the recipient's wallet address (e.g. `0xD37c...`)
3. Nexash automatically looks up their verified profile from `NexashUserRegistry`
4. If verified, you will see: "KYC Level 2 verified via NexaID · Attestation found on-chain"
5. Enter the payment amount
6. Select the token
7. Click **Generate Proof & Pay**

### What Happens During Payment

Two UltraHonk proofs are generated in your browser simultaneously:

**Identity Proof (~45s):**
Uses the recipient's `reportTxHash` and `taskId` from the registry to prove they are KYC-compliant. You never see their personal data — only the proof result.

**Policy Proof (~45s):**
Uses your treasury's spending policy to prove the payment is within configured limits.

Both proofs are submitted to `ZKTreasury.executePayment()` in a single transaction. If either proof fails verification, the payment reverts.

---

## Managing Your Treasury

### Admin Panel

Access the Admin panel from your treasury dashboard:

**Roles tab** — Add or remove members and set their role levels
**Policy tab** — Update spending limits, KYC requirements, or multisig threshold
**Tokens tab** — Add new allowed tokens to the treasury
**Emergency tab** — Pause all payments if needed

### Payment History

The payment history shows every executed payment with:
- Transaction hash
- Block number
- Recipient address
- Amount
- ZK proof status

All payments are permanently on-chain and auditable. The payment history serves as your compliance audit trail.

---

## Compliance Considerations

**What you can prove to regulators:**
- Every payment was made to a recipient with verified KYC ≥ level 2
- Every payment was within your configured spending policy
- Both conditions were verified by on-chain ZK proofs (permanent record)
- The KYC verification was anchored to an NexaID attestation on HashKey Chain

**What you cannot prove (by design):**
- The specific identity of any recipient
- Their exact KYC level beyond the minimum
- Their jurisdiction

This is the privacy guarantee: compliance is provable, identity is not.

---

## Frequently Asked Questions

**Q: Can I have multiple treasuries?**
Yes. Each treasury has independent funds, policy, and member list. A single organization can deploy as many treasuries as needed.

**Q: What if a recipient is not yet verified on Nexash?**
The payment modal shows "Recipient has not completed NexaID KYC verification" and the payment button is disabled. You must wait for the recipient to complete verification.

**Q: Can I update the spending policy after deployment?**
Yes, via the Policy tab in the Admin panel. Policy updates take effect immediately for new payments. In-flight proofs generated before the update will fail if the policy hash changes.

**Q: What is the multisig threshold for?**
If set to N > 1, payments require N operator approvals before executing. The first operator initiates, subsequent operators approve. This is designed for large treasuries where additional oversight is required.
