'use client'

import { Suspense } from 'react'
import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUserType } from '@/hooks/useRegistry'

function DashboardRouterInner() {
  const { ready, authenticated } = usePrivy()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const treasuryAddr = searchParams.get('treasury')

  const { data: userType, isLoading } = useUserType()

  useEffect(() => {
    if (!ready) return
    if (!authenticated) { router.replace('/'); return }
    if (isLoading) return
    if (userType === 'none') { router.replace('/onboarding'); return }
    if (userType === 'individual') { router.replace('/individual'); return }
    if (userType === 'institution') {
      if (treasuryAddr) {
        router.replace(`/institution/treasury?address=${treasuryAddr}`)
      } else {
        router.replace('/institution')
      }
    }
  }, [ready, authenticated, userType, isLoading, router, treasuryAddr])

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-3">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-[13px] text-neutral-400">Loading your dashboard...</p>
    </div>
  )
}

export default function DashboardRouter() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardRouterInner />
    </Suspense>
  )
}
