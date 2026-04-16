'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ConnectButton } from '@/components/ui/ConnectButton'
import { usePrivy } from '@privy-io/react-auth'
import { useUserType } from '@/hooks/useRegistry'

const NAV_LINKS = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Why HashKey',  href: '/why-hashkey' },
  {
    label: 'Explorer',
    href: 'https://testnet-explorer.hsk.xyz/address/0x3d1e6d13b3a9e90c10f2b19a19f58159c8564e88',
    external: true,
  },
]

export function Navbar() {
  const { authenticated } = usePrivy()
  const { data: userType } = useUserType()
  const router   = useRouter()
  const pathname = usePathname()

  function getDashboardRoute() {
    if (!userType || userType === 'none') return '/onboarding'
    if (userType === 'individual') return '/individual'
    return '/institution'
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 h-16 bg-white/90 backdrop-blur-md border-b border-black/[0.06]">
      <div className="flex items-center gap-10">
        <Link href="/" className="flex items-center gap-1.5 group">
          <span className="text-[15px] font-bold tracking-[-0.5px] text-black">Nexash</span>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 group-hover:scale-125 transition-transform" />
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = !link.external && pathname === link.href
            return link.external ? (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3.5 py-1.5 text-[13px] text-neutral-500 hover:text-black transition-colors rounded-lg hover:bg-neutral-50"
              >
                {link.label}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-40">
                  <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </a>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className={`px-3.5 py-1.5 text-[13px] rounded-lg transition-colors
                  ${isActive
                    ? 'text-black font-medium bg-neutral-100'
                    : 'text-neutral-500 hover:text-black hover:bg-neutral-50'}`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {authenticated && (
          <button
            onClick={() => router.push(getDashboardRoute())}
            className="px-3.5 py-1.5 text-[13px] text-neutral-600 hover:text-black border border-neutral-200 rounded-lg transition-colors hover:border-neutral-400"
          >
            Dashboard
          </button>
        )}
        <ConnectButton variant="nav" />
      </div>
    </nav>
  )
}
