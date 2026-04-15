import { NextRequest, NextResponse } from 'next/server'
import { buildHSPHeaders } from '@/lib/hsp/hmac'
import { signMerchantJWT } from '@/lib/hsp/jwt'
import { canonicalJson } from '@/lib/hsp/canonicalJson'

const HSP_BASE = process.env.HSP_BASE_URL!
const MERCHANT_NAME = process.env.HSP_MERCHANT_NAME ?? 'Nexus'

// POST — create HSP order or other write operations
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, ...params } = body

    if (action === 'create-order') {
      return await createOrder(params)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    console.error('[HSP API]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET — query payment status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const paymentRequestId = searchParams.get('payment_request_id')

    if (action === 'get-status' && paymentRequestId) {
      return await getPaymentStatus(paymentRequestId)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function createOrder(params: {
  cartMandateId: string
  paymentRequestId: string
  tokenAddress: string
  payTo: string
  amountUsdc: string
  coin: string
  cartExpiry: string
}) {
  const path = '/api/v1/merchant/orders'

  // Build cart contents
  const cartContents = {
    id: params.cartMandateId,
    user_cart_confirmation_required: true,
    payment_request: {
      method_data: [
        {
          supported_methods: 'https://www.x402.org/',
          data: {
            x402Version: 2,
            network: 'hashkey-testnet',
            chain_id: 133,
            contract_address: params.tokenAddress,
            pay_to: params.payTo,
            coin: params.coin,
          },
        },
      ],
      details: {
        id: params.paymentRequestId,
        display_items: [
          {
            label: 'Nexash Treasury Payment',
            amount: { currency: 'USD', value: params.amountUsdc },
          },
        ],
        total: {
          label: 'Total',
          amount: { currency: 'USD', value: params.amountUsdc },
        },
      },
    },
    cart_expiry: params.cartExpiry,
    merchant_name: MERCHANT_NAME,
  }

  // Sign merchant JWT with ES256K
  const merchantAuthorization = await signMerchantJWT(cartContents)

  const requestBody = {
    cart_mandate: {
      contents: cartContents,
      merchant_authorization: merchantAuthorization,
    },
  }

  // Build HMAC headers
  const headers = await buildHSPHeaders('POST', path, '', requestBody)

  const res = await fetch(`${HSP_BASE}${path}`, {
    method: 'POST',
    headers,
    body: canonicalJson(requestBody),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

async function getPaymentStatus(paymentRequestId: string) {
  const path = '/api/v1/merchant/payments'
  const query = `payment_request_id=${encodeURIComponent(paymentRequestId)}`

  const headers = await buildHSPHeaders('GET', path, query, null)

  const res = await fetch(`${HSP_BASE}${path}?${query}`, { headers })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
