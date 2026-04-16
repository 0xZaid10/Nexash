'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { ConnectButton } from '@/components/ui/ConnectButton'
import Link from 'next/link'

export function Hero() {
  const { authenticated } = usePrivy()
  const router = useRouter()

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-white pt-16">

      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, black 1px, transparent 1px),
            linear-gradient(to bottom, black 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Indigo glow top-left */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-indigo-100 opacity-40 blur-3xl pointer-events-none" />
      {/* Subtle glow bottom-right */}
      <div className="absolute -bottom-48 -right-24 w-[500px] h-[500px] rounded-full bg-indigo-50 opacity-60 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-12 w-full">
        <div className="grid grid-cols-2 gap-16 items-center min-h-[calc(100vh-64px)]">

          {/* Left */}
          <div className="py-20">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[12px] font-medium text-indigo-600 tracking-wide">
                Live on HashKey Chain · Chain ID 133
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-[52px] font-bold leading-[1.08] tracking-[-2px] text-black mb-6">
              Institutional<br />
              treasury, built<br />
              on <span className="text-indigo-600">proof.</span>
            </h1>

            <p className="text-[15px] text-neutral-500 leading-[1.75] max-w-[420px] mb-10">
              Hold and move stablecoins with full regulatory compliance.
              Every payment verified by zero-knowledge cryptographic proofs —
              no personal data on-chain, no intermediaries.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-3">
              {authenticated ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-2 px-6 py-3 bg-black text-white text-[13px] font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
                >
                  Open treasury
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M7 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ) : (
                <ConnectButton variant="hero" />
              )}
              <a
                href="https://testnet-explorer.hsk.xyz/tx/0xe4ce2f122dee2aeb6e80a2b7b52c6157bfecf0e6a72303fb97ba4ae3a7519964"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-white text-black text-[13px] border border-neutral-200 rounded-xl hover:border-neutral-400 hover:bg-neutral-50 transition-colors"
              >
                View on explorer
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M2 9L9 2M9 2H5M9 2v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </a>
            </div>

            {/* Proof badges */}
            <div className="flex items-center gap-4 mt-10">
              <div className="flex items-center gap-1.5 text-[12px] text-neutral-400">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5l3 3 6-6" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                UltraHonk · No trusted setup
              </div>
              <div className="w-px h-3 bg-neutral-200" />
              <div className="flex items-center gap-1.5 text-[12px] text-neutral-400">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5l3 3 6-6" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                54/54 tests passing
              </div>
              <div className="w-px h-3 bg-neutral-200" />
              <div className="flex items-center gap-1.5 text-[12px] text-neutral-400">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5l3 3 6-6" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                HSP integrated
              </div>
            </div>
          </div>

          {/* Right — visual card stack */}
          <div className="relative h-full flex items-center justify-center py-20">

            {/* Background card */}
            <div className="absolute top-24 right-0 w-72 h-44 bg-indigo-50 border border-indigo-100 rounded-2xl rotate-3 opacity-60" />

            {/* Main card */}
            <div className="relative w-80 bg-white border border-neutral-200 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-[12px] font-medium text-neutral-600">Nexash Treasury</span>
                </div>
                <span className="text-[11px] text-indigo-500 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">Active</span>
              </div>

              {/* Balance */}
              <div className="px-5 py-5 border-b border-neutral-100">
                <div className="text-[11px] text-neutral-400 mb-1">Treasury balance</div>
                <div className="text-[28px] font-bold text-black tracking-tight">47.00</div>
                <div className="text-[12px] text-neutral-400 mt-0.5">USDC.e available</div>
              </div>

              {/* Payment row */}
              <div className="px-5 py-4 border-b border-neutral-100">
                <div className="text-[11px] text-neutral-400 mb-3">Latest payment</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-medium text-black">0x7a59...00E5</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                      ZK proof verified
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-semibold text-black">1.00 USDC.e</div>
                    <div className="text-[10px] text-green-600 font-medium mt-0.5">✓ confirmed</div>
                  </div>
                </div>
              </div>

              {/* ZK badge */}
              <div className="px-5 py-3.5 bg-neutral-50 flex items-center justify-between">
                <span className="text-[11px] text-neutral-400">Proof system</span>
                <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                  UltraHonk · Noir
                </span>
              </div>
            </div>

            {/* Floating proof indicator */}
            <div className="absolute bottom-28 -left-4 bg-white border border-neutral-200 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l3.5 3.5L12 3" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-black">Proof verified</div>
                <div className="text-[10px] text-neutral-400">9,024 bytes · on-chain</div>
              </div>
            </div>

            {/* Floating HSP indicator */}
            <div className="absolute top-28 -left-8 bg-white border border-neutral-200 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] px-4 py-3">
              <div className="text-[10px] text-neutral-400 mb-0.5">HSP mandate</div>
              <div className="text-[11px] font-semibold text-black">Cart Mandate created</div>
              <div className="text-[10px] text-indigo-500 mt-0.5">payment-successful ✓</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
