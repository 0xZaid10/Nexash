import { SignJWT, importPKCS8 } from 'jose'
import { canonicalJson, sha256Hex } from './canonicalJson'

// ES256K JWT for merchant_authorization per HSP spec
// Algorithm: ECDSA with secp256k1 curve and SHA-256
// Claims: iss, sub, aud, iat, exp, jti, cart_hash

export async function signMerchantJWT(cartContents: object): Promise<string> {
  const privateKeyPem = process.env.HSP_MERCHANT_PRIVATE_KEY!
    .replace(/\\n/g, '\n')

  const privateKey = await importPKCS8(privateKeyPem, 'ES256K')

  // Compute cart_hash = SHA-256 of canonical JSON of cart contents
  const cartHash = await sha256Hex(canonicalJson(cartContents))

  const now = Math.floor(Date.now() / 1000)
  const jti = `JWT-${now}-${Math.random().toString(36).slice(2, 8)}`

  const merchantName = process.env.HSP_MERCHANT_NAME ?? 'Nexus'

  const jwt = await new SignJWT({
    cart_hash: cartHash,
  })
    .setProtectedHeader({ alg: 'ES256K', typ: 'JWT' })
    .setIssuer(merchantName)
    .setSubject(merchantName)
    .setAudience('HashkeyMerchant')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setJti(jti)
    .sign(privateKey)

  return jwt
}
