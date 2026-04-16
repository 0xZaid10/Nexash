'use client'

import { PrivyProvider as BasePrivyProvider } from '@privy-io/react-auth'
import { hashkeyTestnet } from '@/lib/contracts/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BasePrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={{
          appearance: {
            theme: 'light',
            accentColor: '#4f46e5',
            logo: '/logo.svg',
          },
          loginMethods: ['email', 'google', 'wallet'],
          defaultChain: hashkeyTestnet,
          supportedChains: [hashkeyTestnet],
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
          },
        }}
      >
        {children}
      </BasePrivyProvider>
    </QueryClientProvider>
  )
}
