'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { ConnectButton } from '@/components/ui/ConnectButton'

export function Footer() {
  const { authenticated } = usePrivy()
  const router = useRouter()

  return (
    <>
      {/* CTA */}
      <section className="px-10 py-20 bg-text-primary text-center">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
          Ready to deploy<br />your treasury?
        </h2>
        <p className="text-sm text-gray-400 mb-8">
          Connect your wallet and have a fully compliant institutional treasury running in under two minutes.
        </p>
        <div className="flex gap-3 justify-center">
          {authenticated ? (
            <button
              onClick={() => router.push('/dashboard')}
              className="px-7 py-3 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition-colors"
            >
              Open your treasury
            </button>
          ) : (
            <ConnectButton variant="hero" />
          )}
          <a
            href="https://testnet-explorer.hsk.xyz/address/0x3d1e6d13b3a9e90c10f2b19a19f58159c8564e88"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-transparent text-gray-400 border border-gray-700 text-sm rounded-lg hover:border-gray-500 transition-colors"
          >
            Read the docs
          </a>
        </div>
      </section>

      {/* Footer bar */}
      <footer className="px-10 py-5 border-t border-border flex justify-between items-center">
        <div className="text-xs text-text-muted">
          Nex<span className="text-brand-600 font-semibold">ash</span>
          {' '}· ZKID + PayFi Track · HashKey Chain On-Chain Horizon Hackathon 2026
        </div>
        <div className="flex gap-5">
          <span className="text-2xs text-text-muted">HashKey Chain Testnet · Chain 133</span>
          <span className="text-2xs text-text-muted">54/54 tests passing</span>
          <span className="text-2xs text-text-muted">UltraHonk · Noir 1.0.0-beta.18</span>
        </div>
      </footer>
    </>
  )
}
