'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { AddressDisplay } from './AddressDisplay'
import { useUserType } from '@/hooks/useRegistry'

interface ConnectButtonProps {
  variant?: 'nav' | 'hero' | 'dashboard'
}

export function ConnectButton({ variant = 'nav' }: ConnectButtonProps) {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const { data: userType } = useUserType()
  const router = useRouter()

  if (!ready) {
    return <div className="h-8 w-28 bg-neutral-100 rounded-lg animate-pulse" />
  }

  const wallet = user?.wallet?.address

  // Determine where to go when clicking "open dashboard"
  function goToDashboard() {
    if (!userType || userType === 'none') {
      router.push('/onboarding')
    } else if (userType === 'individual') {
      router.push('/individual')
    } else {
      router.push('/institution')
    }
  }

  if (authenticated && wallet) {
    if (variant === 'hero') {
      return (
        <button
          onClick={goToDashboard}
          className="flex items-center gap-2 px-6 py-3 bg-black text-white text-[13px] font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
        >
          Open dashboard
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8M7 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <AddressDisplay address={wallet} truncate showCopy={false} className="text-neutral-700 text-[12px]" />
        </div>
        <button
          onClick={logout}
          className="text-[11px] text-neutral-400 hover:text-neutral-600 border border-neutral-200 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    )
  }

  if (variant === 'hero') {
    return (
      <button
        onClick={login}
        className="flex items-center gap-2 px-6 py-3 bg-black text-white text-[13px] font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
      >
        Get started
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M7 3l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    )
  }

  return (
    <button
      onClick={login}
      className="px-4 py-1.5 bg-black text-white text-[12px] font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
    >
      Sign in
    </button>
  )
}
