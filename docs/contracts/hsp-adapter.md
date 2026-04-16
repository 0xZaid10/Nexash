# HSPAdapter

`HSPAdapter` is the on-chain integration point between Nexash's `ZKTreasury` and HashKey Pay (HSP). It provides an interface for recording HSP payment mandates alongside ZK-verified on-chain transfers.

---

## Overview

HSP is HashKey Chain's native payment protocol. `HSPAdapter` allows `ZKTreasury` to register a payment with HSP's structured mandate system in addition to executing the raw token transfer. This dual approach provides:

- On-chain ZK compliance verification (via `ZKTreasury`)
- Structured payment receipt (via HSP mandate)
- Traditional finance-compatible reporting (via HSP's API)

---

## Architecture

The HSP integration in Nexash has two layers:

**Server-side (Next.js API route — `app/api/hsp/route.ts`):**
Handles merchant authentication, cart mandate construction, JWT signing, and HMAC-SHA256 signing. All credentials remain server-side.

**On-chain (HSPAdapter.sol):**
Lightweight contract that can be called by `ZKTreasury` to record that an HSP mandate was created for a specific payment.

---

## Server-Side Flow

```
Frontend
    │
    │ POST /api/hsp { action: 'create-order', ... }
    ▼
Next.js API Route (server-side)
    │
    ├── Build cart contents
    ├── Canonical JSON → SHA-256 → cart_hash
    ├── Sign merchant JWT (ES256K)
    ├── Sign request (HMAC-SHA256)
    │
    │ POST /api/v1/merchant/orders
    ▼
HSP API
    │
    │ returns: payment_url, payment_request_id
    ▼
Frontend
    │
    │ polls: GET /api/hsp?action=get-status&payment_request_id=...
    ▼
HSP API → payment-successful / payment-failed
```

---

## Cart Mandate Structure

Every HSP payment includes a cart mandate — a structured description of the payment with merchant authentication:

```json
{
  "cart_mandate": {
    "contents": {
      "id": "ORDER-001",
      "user_cart_confirmation_required": true,
      "payment_request": {
        "method_data": [{
          "supported_methods": "https://www.x402.org/",
          "data": {
            "x402Version": 2,
            "network": "hashkey-testnet",
            "chain_id": 133,
            "contract_address": "0x8FE3cB...",
            "pay_to": "0xTreasuryAddress...",
            "coin": "USDC"
          }
        }],
        "details": {
          "id": "PAY-REQ-001",
          "total": { "label": "Total", "amount": { "currency": "USD", "value": "1.00" } }
        }
      },
      "cart_expiry": "2025-03-01T12:00:00Z",
      "merchant_name": "Nexash"
    },
    "merchant_authorization": "eyJhbG..."
  }
}
```

---

## Payment Terminal States

HSP tracks payment status through a state machine:

| State | Terminal | Description |
|---|---|---|
| `payment-required` | No | Awaiting payer action |
| `payment-submitted` | No | Authorization submitted |
| `payment-verified` | No | Authorization verified |
| `payment-processing` | No | On-chain transaction in flight |
| `payment-included` | No | Included in block, awaiting confirmations |
| `payment-successful` | **Yes** | Confirmed and complete |
| `payment-failed` | **Yes** | Failed — can be retried |

Nexash polls until `payment-successful` or `payment-failed` before showing the result to the institution.

---

## Deployed Address

`HSPAdapter`: `0x4C742961EcF15F90308a27bda9966f16e035ED3f` (HashKey Chain Testnet)
