'use client'

import { useState, useEffect } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { useUserType, useOrgProfile, useOrgTreasuries, addTreasuryToOrg } from '@/hooks/useRegistry'
import { publicClient, getExplorerAddressUrl } from '@/lib/contracts/client'
import { ZK_TREASURY_ABI } from '@/lib/contracts/abis'
import { TOKENS } from '@/lib/contracts/addresses'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'

interface TreasurySummary {
  address: string
  name:    string
  balance: bigint
  paused:  boolean
  members: bigint
}

export default function InstitutionDashboard() {
  const { ready, authenticated, user, logout } = usePrivy()
  const { wallets } = useWallets()
  const router = useRouter()
  const { data: userType }                       = useUserType()
  const { data: orgProfile }                     = useOrgProfile()
  const { data: treasuries, refetch: refetchT }  = useOrgTreasuries()

  const [summaries,    setSummaries]    = useState<TreasurySummary[]>([])
  const [loading,      setLoading]      = useState(false)
  const [showLink,     setShowLink]     = useState(false)
  const [linkAddr,     setLinkAddr]     = useState('')
  const [linking,      setLinking]      = useState(false)
  const [linkError,    setLinkError]    = useState('')

  useEffect(() => {
    if (!ready) return
    if (!authenticated) router.replace('/')
    if (userType === 'none') router.replace('/onboarding')
    if (userType === 'individual') router.replace('/individual')
  }, [ready, authenticated, userType, router])

  useEffect(() => {
    if (!treasuries || treasuries.length === 0) return
    loadSummaries(treasuries)
  }, [treasuries])

  async function loadSummaries(addrs: string[]) {
    setLoading(true)
    const results = await Promise.allSettled(
      addrs.map(async (addr) => {
        // Skip ghost addresses with no code
        const code = await publicClient.getCode({ address: addr as `0x${string}` })
        if (!code || code === '0x') return null

        const [name, balance, paused, memberCount] = await Promise.all([
          publicClient.readContract({ address: addr as `0x${string}`, abi: ZK_TREASURY_ABI, functionName: 'name' }),
          publicClient.readContract({ address: addr as `0x${string}`, abi: ZK_TREASURY_ABI, functionName: 'getBalance', args: [TOKENS.USDC_E] }),
          publicClient.readContract({ address: addr as `0x${string}`, abi: ZK_TREASURY_ABI, functionName: 'paused' }),
          publicClient.readContract({ address: addr as `0x${string}`, abi: ZK_TREASURY_ABI, functionName: 'getMemberCount' }),
        ])
        return { address: addr, name: name as string, balance: balance as bigint, paused: paused as boolean, members: memberCount as bigint }
      })
    )
    const valid = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<TreasurySummary | null>).value!)
    setSummaries(valid)
    setLoading(false)
  }

  async function handleLinkTreasury() {
    if (!linkAddr.trim()) return
    setLinking(true)
    setLinkError('')
    try {
      await addTreasuryToOrg(linkAddr.trim(), wallets)
      setLinkAddr('')
      setShowLink(false)
      await refetchT()
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLinking(false)
    }
  }

  if (!ready || !authenticated || !orgProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-14 bg-white/90 backdrop-blur-md border-b border-neutral-100">
        <Link href="/" className="text-[14px] font-bold tracking-tight text-black">
          Nexash<span className="text-indigo-600">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-black">{orgProfile.displayName}</span>
          <span className="text-[11px] text-neutral-400">@{orgProfile.name}</span>
          {user?.wallet?.address && (
            <AddressDisplay address={user.wallet.address} truncate showCopy={false} className="text-neutral-400" />
          )}
          <button onClick={logout} className="text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <div className="pt-14 max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-black tracking-tight">{orgProfile.displayName}</h1>
            <p className="text-[12px] text-neutral-400 mt-0.5">
              @{orgProfile.name} · {summaries.length} {summaries.length === 1 ? 'treasury' : 'treasuries'} active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLink(!showLink)}
              className="px-3.5 py-2 text-[12px] text-neutral-600 border border-neutral-200 rounded-xl hover:border-neutral-400 transition-colors"
            >
              Link existing
            </button>
            <Link
              href="/institution/new"
              className="flex items-center gap-2 px-4 py-2 bg-black text-white text-[13px] font-medium rounded-xl hover:bg-neutral-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              New treasury
            </Link>
          </div>
        </div>

        {/* Link existing treasury form */}
        {showLink && (
          <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <div className="flex-1">
              <label className="label">Treasury address to link</label>
              <input
                className="input"
                placeholder="0x..."
                value={linkAddr}
                onChange={e => setLinkAddr(e.target.value)}
              />
              {linkError && <p className="text-[11px] text-red-500 mt-1">{linkError}</p>}
              <p className="text-[11px] text-neutral-400 mt-1">
                Link an existing ZKTreasury deployed by your wallet to this organisation.
                Try: <button
                  onClick={() => setLinkAddr('0x16274C09f803C646928383950614eF6922F50F60')}
                  className="text-indigo-500 underline"
                >
                  0x16274...F60
                </button>
              </p>
            </div>
            <div className="flex gap-2 pt-5">
              <button
                onClick={() => { setShowLink(false); setLinkAddr(''); setLinkError('') }}
                className="px-3 py-2 text-[12px] border border-neutral-200 rounded-lg text-neutral-500 hover:border-neutral-400"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkTreasury}
                disabled={!linkAddr || linking}
                className="px-3 py-2 text-[12px] bg-black text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50"
              >
                {linking ? 'Linking...' : 'Link'}
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total treasuries',  value: (treasuries?.length ?? 0).toString() },
            { label: 'Active treasuries', value: summaries.filter(s => !s.paused).length.toString() },
            { label: 'Total USDC.e',      value: summaries.reduce((a, s) => a + Number(s.balance) / 1e6, 0).toFixed(2) },
          ].map(s => (
            <div key={s.label} className="bg-white border border-neutral-200 rounded-xl p-5">
              <div className="text-[11px] text-neutral-400 mb-1">{s.label}</div>
              <div className="text-[20px] font-bold text-black tracking-tight">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Treasury list */}
        {loading ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[12px] text-neutral-400 mt-3">Loading treasuries...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="5" width="16" height="12" rx="2" stroke="#9ca3af" strokeWidth="1.2"/>
                <path d="M6 5V4a4 4 0 018 0v1" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-[14px] font-medium text-neutral-600 mb-1">No treasuries found</p>
            <p className="text-[12px] text-neutral-400 mb-5">
              Deploy a new treasury or link an existing one
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowLink(true)}
                className="btn-secondary text-[13px]"
              >
                Link existing treasury
              </button>
              <Link href="/institution/new" className="btn-primary text-[13px]">
                Deploy new treasury
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {summaries.map(t => (
              <Link
                key={t.address}
                href={`/institution/treasury?address=${t.address}`}
                className="bg-white border border-neutral-200 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-[15px] font-semibold text-black group-hover:text-indigo-600 transition-colors">
                      {t.name}
                    </h3>
                    <AddressDisplay address={t.address} truncate showCopy={false} className="text-neutral-400 text-[11px] mt-0.5" />
                  </div>
                  <StatusBadge status={t.paused ? 'paused' : 'active'} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <div className="text-[10px] text-neutral-400 mb-0.5">Balance</div>
                    <div className="text-[15px] font-semibold text-black">
                      {(Number(t.balance) / 1e6).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-neutral-400">USDC.e</div>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <div className="text-[10px] text-neutral-400 mb-0.5">Members</div>
                    <div className="text-[15px] font-semibold text-black">{t.members.toString()}</div>
                    <div className="text-[10px] text-neutral-400">wallets</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  UltraHonk · ZK-gated · HSP audit
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
