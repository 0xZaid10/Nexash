import { readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'

const path = './node_modules/@nexaid/network-js-sdk/dist/index-DiCqXokS.mjs'

let content
try {
  content = readFileSync(path, 'utf8')
  console.log('NexaID SDK found, size:', content.length)
} catch {
  console.log('NexaID SDK not found, skipping patch')
  process.exit(0)
}

const CHAIN = `{ id: 133, name: "HashKey Chain Testnet", nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 }, rpcUrls: { default: { http: ["https://testnet.hsk.xyz"] }, public: { http: ["https://testnet.hsk.xyz"] } } }`

// Find and replace walletClient creation without chain
const walletPattern = /walletClient:\s*Zm\(\{\s*transport:\s*Ps\(n\)\s*\}\)/
const publicPattern = /publicClient:\s*ua\(\{\s*transport:\s*Ps\(n\)\s*\}\)/

let patched = content
let count = 0

if (publicPattern.test(content)) {
  patched = patched.replace(publicPattern, `publicClient: ua({ chain: ${CHAIN}, transport: Ps(n) })`)
  count++
  console.log('Patched publicClient')
} else {
  console.log('publicClient pattern not found')
}

if (walletPattern.test(patched)) {
  patched = patched.replace(walletPattern, `walletClient: Zm({ chain: ${CHAIN}, transport: Ps(n) })`)
  count++
  console.log('Patched walletClient')
} else {
  console.log('walletClient pattern not found')
}

writeFileSync(path, patched)
console.log('NexaID SDK patch complete:', count, 'replacements')
