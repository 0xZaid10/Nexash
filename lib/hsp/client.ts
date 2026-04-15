// HSP API client — all calls go through our Next.js API route
// to keep HSP_APP_SECRET and HSP_MERCHANT_PRIVATE_KEY server-side only

export interface CartMandateContents {
  id: string
  user_cart_confirmation_required: boolean
  payment_request: {
    method_data: Array<{
      supported_methods: string
      data: {
        x402Version: number
        network: string
        chain_id: number
        contract_address: string
        pay_to: string
        coin: string
      }
    }>
    details: {
      id: string
      display_items: Array<{ label: string; amount: { currency: string; value: string } }>
      total: { label: string; amount: { currency: string; value: string } }
    }
  }
  cart_expiry: string
  merchant_name: string
}

export interface CreateOrderResponse {
  code: number
  msg: string
  data: {
    payment_request_id: string
    payment_url: string
    multi_pay: boolean
  }
}

export interface PaymentStatusResponse {
  code: number
  msg: string
  data: Array<{
    payment_request_id: string
    status: string
    tx_signature?: string
    amount: string
    token: string
    payer_address?: string
    to_pay_address: string
    created_at: string
    completed_at?: string
    status_reason?: string
  }>
}

// Create a one-time HSP Cart Mandate
export async function createHSPOrder(
  cartMandateId: string,
  paymentRequestId: string,
  tokenAddress: string,
  payTo: string,
  amountUsdc: string, // human-readable, e.g. "1.00"
  coin: string        // e.g. "USDC"
): Promise<CreateOrderResponse> {
  const cartExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  const body = {
    action: 'create-order',
    cartMandateId,
    paymentRequestId,
    tokenAddress,
    payTo,
    amountUsdc,
    coin,
    cartExpiry,
  }

  const res = await fetch('/api/hsp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`HSP API error: ${res.status}`)
  return res.json()
}

// Poll payment status by payment_request_id
export async function getPaymentStatus(
  paymentRequestId: string
): Promise<PaymentStatusResponse> {
  const res = await fetch(
    `/api/hsp?action=get-status&payment_request_id=${encodeURIComponent(paymentRequestId)}`
  )
  if (!res.ok) throw new Error(`HSP status error: ${res.status}`)
  return res.json()
}

// Poll until terminal state or timeout
export async function pollPaymentStatus(
  paymentRequestId: string,
  timeoutMs = 120_000,
  intervalMs = 5_000
): Promise<string> {
  const terminalStates = ['payment-successful', 'payment-failed']
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const res = await getPaymentStatus(paymentRequestId)
    const payment = res.data?.[0]
    if (payment && terminalStates.includes(payment.status)) {
      return payment.status
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  return 'timeout'
}
