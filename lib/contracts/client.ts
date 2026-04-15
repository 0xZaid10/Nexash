import { createPublicClient, createWalletClient, http, defineChain } from 'viem'

export const hashkeyTestnet = defineChain({
  id: 133,
  name: 'HashKey Chain Testnet',
  network: 'hashkey-testnet',
  nativeCurrency: { name: 'HSK', symbol: 'HSK', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.hsk.xyz'] },
    public:  { http: ['https://testnet.hsk.xyz'] },
  },
  blockExplorers: {
    default: { name: 'HashKey Explorer', url: 'https://testnet-explorer.hsk.xyz' },
  },
  testnet: true,
})

export const publicClient = createPublicClient({
  chain: hashkeyTestnet,
  transport: http('https://testnet.hsk.xyz'),
})

export function getExplorerTxUrl(txHash: string) {
  return `https://testnet-explorer.hsk.xyz/tx/${txHash}`
}

export function getExplorerAddressUrl(address: string) {
  return `https://testnet-explorer.hsk.xyz/address/${address}`
}
