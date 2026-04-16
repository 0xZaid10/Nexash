'use client'

import { useState, useEffect, Suspense } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { publicClient, getExplorerTxUrl, getExplorerAddressUrl } from '@/lib/contracts/client'
import { ZK_TREASURY_ABI, POLICY_ENGINE_ABI, ERC20_ABI } from '@/lib/contracts/abis'
import { CONTRACTS, TOKENS } from '@/lib/contracts/addresses'
import { TopBar }           from '@/components/dashboard/TopBar'
import { TreasuryOverview } from '@/components/dashboard/TreasuryOverview'
import { PaymentTable }     from '@/components/dashboard/PaymentTable'
import { PolicyCard }       from '@/components/dashboard/PolicyCard'
import { MemberCard }       from '@/components/dashboard/MemberCard'
import { PaymentModal }     from '@/components/modals/PaymentModal'
import { AdminModal }       from '@/components/modals/AdminModal'
import Link from 'next/link'
import type { TreasuryState } from '@/hooks/useTreasury'

function TreasuryDetailInner() {
  const { ready, authenticated, user } = usePrivy()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const address      = searchParams.get('address') as `0x${string}` | null

  const [showPayment, setShowPayment] = useState(false)
  const [showAdmin,   setShowAdmin]   = useState(false)

  useEffect(() => {
    if (ready && !authenticated) router.replace('/')
    if (ready && !address) router.replace('/institution')
  }, [ready, authenticated, address, router])

  const { data: treasury, isLoading, refetch } = useQuery({
    queryKey: ['treasury-detail', address, user?.wallet?.address],
    queryFn:  async (): Promise<TreasuryState | null> => {
      if (!address) return null
      const wallet = user?.wallet?.address as `0x${string}` | undefined

      const [
        name, initialized, paused,
        balance, members, memberCount,
        allowedTokens, policy, userRole,
      ] = await Promise.all([
        publicClient.readContract({ address, abi: ZK_TREASURY_ABI, functionName: 'name' }),
        publicClient.readContract({ address, abi: ZK_TREASURY_ABI, functionName: 'initialized' }),
        publicClient.readContract({ address, abi: ZK_TREASURY_ABI, functionName: 'paused' }),
        publicClient.readContract({ address, abi: ZK_TREASURY_ABI, functionName: 'getBalance', args: [TOKENS.USDC_E] }),
        publicClient.readContract({ address, abi: ZK_TREASURY_ABI, functionName: 'getMembers' }),
        publicClient.readContract({ address, abi: ZK_TREASURY_ABI, functionName: 'getMemberCount' }),
        publicClient.readContract({ address, abi: ZK_TREASURY_ABI, functionName: 'getAllowedTokens' }),
        publicClient.readContract({ address: CONTRACTS.POLICY_ENGINE, abi: POLICY_ENGINE_ABI, functionName: 'getPolicy', args: [address] }),
        wallet
          ? publicClient.readContract({ address, abi: ZK_TREASURY_ABI, functionName: 'roles', args: [wallet] })
          : Promise.resolve(0),
      ])

      const role = Number(userRole) as 0 | 1 | 2 | 3

      return {
        name:             name as string,
        initialized:      initialized as boolean,
        paused:           paused as boolean,
        balance:          balance as bigint,
        members:          members as string[],
        memberCount:      memberCount as bigint,
        allowedTokens:    allowedTokens as string[],
        policy:           policy as TreasuryState['policy'],
        currentUserRole:  role,
        isAdmin:          role === 3,
        isOperator:       role >= 2,
      }
    },
    enabled:        !!address && !!ready,
    refetchInterval: 15_000,
  })

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isLoading || !treasury) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="h-14 bg-white border-b border-neutral-100" />
        <div className="max-w-6xl mx-auto px-7 py-7 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <TopBar
        treasuryName={treasury.name}
        paused={treasury.paused}
        currentRole={treasury.currentUserRole}
      />

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-7 pt-5">
        <div className="flex items-center gap-2 text-[12px] text-neutral-400 mb-5">
          <Link href="/institution" className="hover:text-neutral-600 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-neutral-600 font-medium">{treasury.name}</span>
          <a
            href={getExplorerAddressUrl(address!)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-indigo-500 hover:underline text-[11px] ml-1"
          >
            {address?.slice(0, 8)}...{address?.slice(-6)} ↗
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-7 pb-7 space-y-5">

        {/* Role notice */}
        {treasury.currentUserRole < 2 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-[13px] text-amber-700">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <circle cx="8" cy="8" r="6.5" stroke="#d97706" strokeWidth="1"/>
              <path d="M8 5v3.5M8 11h.01" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Connected wallet has <strong className="mx-1">viewer access</strong> to this treasury.
            Connect the admin wallet to initiate payments or make changes.
          </div>
        )}

        {/* Overview */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <TreasuryOverview
            treasury={treasury}
            treasuryAddress={address!}
            onNewPayment={() => setShowPayment(true)}
            onAdmin={() => setShowAdmin(true)}
            onRefresh={() => refetch()}
          />
        </div>

        {/* Payment history */}
        <PaymentTable treasuryAddress={address!} />

        {/* Policy + Members */}
        <div className="grid grid-cols-2 gap-5">
          <PolicyCard treasury={treasury} />
          <MemberCard treasury={treasury} treasuryAddress={address!} />
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          treasury={treasury}
          treasuryAddress={address!}
          onClose={() => { setShowPayment(false); refetch() }}
        />
      )}

      {showAdmin && (
        <AdminModal
          treasury={treasury}
          treasuryAddress={address!}
          onClose={() => setShowAdmin(false)}
          onRefresh={() => refetch()}
        />
      )}
    </div>
  )
}

export default function TreasuryDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TreasuryDetailInner />
    </Suspense>
  )
}
