import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { PrivyProvider } from '@/providers/PrivyProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nexash — Institutional Treasury on HashKey Chain',
  description: 'Hold and move stablecoins with full regulatory compliance. Verified by cryptographic proofs, not by trusted third parties.',
  keywords: ['institutional treasury', 'zero knowledge', 'HashKey Chain', 'DeFi compliance', 'ZK proofs'],
  openGraph: {
    title: 'Nexash — Institutional Treasury',
    description: 'Compliance enforced by mathematics, not by trust.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <PrivyProvider>
          {children}
        </PrivyProvider>
      </body>
    </html>
  )
}
