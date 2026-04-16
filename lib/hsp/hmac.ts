import { canonicalJson, sha256Hex } from './canonicalJson'

// HMAC-SHA256 signing per HSP authentication spec
// message = "METHOD\nPATH\nQUERY\nbodyHash\ntimestamp\nnonce"

async function hmacSha256(secret: string, message: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    new TextEncoder().encode(message)
  )
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface HMACHeaders {
  'X-App-Key':    string
  'X-Signature':  string
  'X-Timestamp':  string
  'X-Nonce':      string
  'Content-Type': string
  [key: string]:  string
}

export async function buildHSPHeaders(
  method: 'GET' | 'POST',
  path: string,
  query: string,
  body: object | null
): Promise<HMACHeaders> {
  const appKey    = process.env.HSP_APP_KEY!
  const appSecret = process.env.HSP_APP_SECRET!
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce     = generateNonce()

  const bodyHash = body
    ? await sha256Hex(canonicalJson(body))
    : ''

  const message = [method, path, query, bodyHash, timestamp, nonce].join('\n')
  const signature = await hmacSha256(appSecret, message)

  return {
    'X-App-Key':    appKey,
    'X-Signature':  signature,
    'X-Timestamp':  timestamp,
    'X-Nonce':      nonce,
    'Content-Type': 'application/json',
  }
}
