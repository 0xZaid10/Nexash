# HashKey Pay (HSP) Integration

HashKey Pay is HashKey Chain's native payment protocol. Nexash integrates HSP to provide structured payment mandates alongside ZK-verified on-chain transfers.

---

## What HSP Provides

HSP adds a structured payment layer on top of raw token transfers:

- **Cart mandates** — Structured payment requests with line items, amounts, and merchant metadata
- **Payment tracking** — Status tracking from submission to confirmation
- **Stablecoin rails** — Native USDC and USDT support on HashKey Chain
- **Merchant authentication** — Cryptographically signed payment requests

---

## Authentication

HSP uses two authentication mechanisms:

### ES256K JWT (Merchant Authorization)

Each payment request includes a `merchant_authorization` JWT signed with the merchant's secp256k1 private key (ES256K algorithm). The JWT contains a `cart_hash` — a SHA-256 hash of the canonical JSON of the cart contents.

```typescript
// lib/hsp/jwt.ts
async function signMerchantJWT(cartContents: CartMandateContents): Promise<string> {
  const cartHash = await hashCanonicalJSON(cartContents)
  const payload = {
    iss: process.env.HSP_APP_KEY,
    sub: process.env.HSP_APP_KEY,
    aud: 'hsp',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    jti: generateUUID(),
    cart_hash: cartHash,
  }
  return sign(payload, privateKey, { algorithm: 'ES256K' })
}
```

### HMAC-SHA256 (Request Signing)

Every HSP API request is signed with HMAC-SHA256 using the `app_secret`. The signature covers the HTTP method, path, query string, body hash, timestamp, and nonce.

```typescript
// lib/hsp/hmac.ts
const message = [method, path, query, bodyHash, timestamp, nonce].join('\n')
const signature = await hmacSha256(appSecret, message)
```

---

## Cart Mandate Structure

```typescript
{
  cart_mandate: {
    contents: {
      id: "ORDER-001",                          // Cart mandate ID
      user_cart_confirmation_required: true,
      payment_request: {
        method_data: [{
          supported_methods: "https://www.x402.org/",
          data: {
            x402Version: 2,
            network: "hashkey-testnet",
            chain_id: 133,
            contract_address: "0x8FE3cB...",   // USDC on HSK testnet
            pay_to: "0x...",                    // Treasury address
            coin: "USDC"
          }
        }],
        details: {
          id: "PAY-REQ-001",
          display_items: [
            { label: "Nexash Treasury Payment", amount: { currency: "USD", value: "1.00" } }
          ],
          total: { label: "Total", amount: { currency: "USD", value: "1.00" } }
        }
      },
      cart_expiry: "2024-03-01T12:00:00Z",
      merchant_name: "Nexash"
    },
    merchant_authorization: "eyJhbG..."
  }
}
```

---

## Canonical JSON

HSP requires Canonical JSON (RFC 8785) for the `cart_hash`. This means:
- Object keys sorted lexicographically (recursively)
- Compact serialization (no extra whitespace)
- SHA-256 of the resulting string

```typescript
// lib/hsp/canonicalJson.ts
function sortKeys(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val
  if (Array.isArray(val)) return val.map(sortKeys)
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(val as object).sort()) {
    sorted[key] = sortKeys((val as Record<string, unknown>)[key])
  }
  return sorted
}
```

---

## Payment Flow

HSP runs server-side in Nexash's Next.js API route (`/api/hsp`) to keep credentials secure:

1. Frontend sends payment params to `/api/hsp` (POST)
2. Server builds cart contents and computes `cart_hash`
3. Server signs `merchant_authorization` JWT with ES256K private key
4. Server signs request with HMAC-SHA256
5. Server POSTs to `POST /api/v1/merchant/orders`
6. HSP returns `payment_url` and `payment_request_id`
7. Frontend polls `GET /api/v1/merchant/payments?payment_request_id=...`
8. Terminal states: `payment-successful` or `payment-failed`

---

## Supported Tokens

| Token | Contract | Chain | Protocol |
|---|---|---|---|
| USDC | `0x8FE3cB719Ee4410E236Cd6b72ab1fCDC06eF53c6` | HashKey testnet (133) | EIP-3009 |
| USDT | `0x372325443233fEbaC1F6998aC750276468c83CC6` | HashKey testnet (133) | Permit2 |

---

## Environment Variables

```
HSP_APP_KEY=             # Application ID from HSP merchant console
HSP_APP_SECRET=          # Application secret for HMAC signing
HSP_MERCHANT_PRIVATE_KEY= # ES256K private key (PKCS#8 format, \n-escaped)
HSP_MERCHANT_NAME=       # Display name for payment mandates
HSP_BASE_URL=            # HSP API base URL
```

> The private key must be in PKCS#8 format. Convert from SEC1 with:
> `openssl pkcs8 -topk8 -nocrypt -in merchant_private_key.pem -out merchant_private_key_pkcs8.pem`
