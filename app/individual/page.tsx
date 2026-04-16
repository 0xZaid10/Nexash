'use client'

import { useState, useEffect } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { useUserType, useUserProfile, verifyIdentityOnChain } from '@/hooks/useRegistry'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { publicClient, getExplorerTxUrl } from '@/lib/contracts/client'
import { CONTRACTS } from '@/lib/contracts/addresses'
import { ZK_TREASURY_ABI } from '@/lib/contracts/abis'
import { initBarretenberg } from '@/lib/zk/barretenberg'
import { generateIdentityProof, buildIdentityInputs } from '@/lib/zk/identity'
import { runNexaIDAttestation, parseAttestationData, isNexaIDInstalled, kycLevelToUint8 } from '@/lib/nexaid/client'
import { REGISTRY_ADDRESSES } from '@/lib/contracts/registries'
import Link from 'next/link'

type VerifyStep = 'idle' | 'nexaid' | 'generating-proof' | 'submitting' | 'done' | 'error'

export default function IndividualDashboard() {
  const { ready, authenticated, user, logout } = usePrivy()
  const { wallets } = useWallets()
  const router = useRouter()
  const { data: userType } = useUserType()
  const { data: profile, refetch: refetchProfile } = useUserProfile()

  const [verifyStep, setVerifyStep] = useState<VerifyStep>('idle')
  const [verifyMsg,  setVerifyMsg]  = useState('')
  const [verifyErr,  setVerifyErr]  = useState('')
  const [txHash,     setTxHash]     = useState('')
  const [payments,   setPayments]   = useState<Array<{
    txHash: string
    blockNumber: bigint
    amount: bigint
    paymentRequestId: string
  }>>([])

  // Redirect checks
  useEffect(() => {
    if (!ready) return
    if (!authenticated) router.replace('/')
    if (userType === 'none') router.replace('/onboarding')
    if (userType === 'institution') router.replace('/institution')
  }, [ready, authenticated, userType, router])

  // Load incoming payments
  useEffect(() => {
    if (!user?.wallet?.address) return
    loadIncomingPayments(user.wallet.address as `0x${string}`)
  }, [user?.wallet?.address])

  async function loadIncomingPayments(wallet: `0x${string}`) {
    try {
      const logs = await publicClient.getLogs({
        address: CONTRACTS.ZK_TREASURY,
        event: {
          type: 'event',
          name: 'PaymentExecuted',
          inputs: [
            { name: 'paymentRequestId', type: 'bytes32', indexed: true },
            { name: 'recipient',        type: 'address', indexed: true },
            { name: 'amount',           type: 'uint256' },
          ],
        },
        args: { recipient: wallet },
        fromBlock: 0n,
      })
      setPayments(logs.map(l => ({
        txHash:           l.transactionHash!,
        blockNumber:      l.blockNumber!,
        amount:           l.args.amount as bigint,
        paymentRequestId: l.args.paymentRequestId as string,
      })).reverse())
    } catch { /* ignore */ }
  }

  async function handleVerify() {
    if (!user?.wallet?.address) return
    setVerifyStep('nexaid')
    setVerifyErr('')

    try {
      const wallet   = wallets[0]
      const provider = await wallet.getEthereumProvider()

      // Step 1 — NexaID attestation
      setVerifyMsg('Running zkTLS attestation with Binance KYC...')
      const attestation = await runNexaIDAttestation(
        user.wallet.address,
        provider,
        msg => setVerifyMsg(msg)
      )
      const kycData = parseAttestationData(attestation)

      // Step 2 — Generate ZK proof
      setVerifyStep('generating-proof')
      setVerifyMsg('Initializing ZK backend...')
      await initBarretenberg(msg => setVerifyMsg(msg))

      setVerifyMsg('Building identity circuit inputs from NexaID attestation...')
      // Use real NexaID attestation values — reportTxHash and taskId
      // from the on-chain attestation. This is trustless — verifiable on HashKey Chain.
      const inputs = await buildIdentityInputs(
        kycLevelToUint8(kycData.passKycLevel),  // from NexaID: INTERMEDIATE = 2
        344,                                     // jurisdiction: HK (open for testnet)
        attestation.reportTxHash,                // NexaID on-chain attestation anchor
        attestation.taskId,                      // NexaID task ID
        REGISTRY_ADDRESSES.USER_REGISTRY,        // bound to user registry
      )

      setVerifyMsg('Generating UltraHonk identity proof (~45s)...')
      const { proof, publicInputs } = await generateIdentityProof(inputs as never)

      // Step 3 — Submit on-chain
      setVerifyStep('submitting')
      setVerifyMsg('Submitting proof to NexashUserRegistry...')
      const hash = await verifyIdentityOnChain(
        proof,
        publicInputs,
        wallets,
        attestation.reportTxHash,
        attestation.taskId,
      )
      setTxHash(hash)

      await refetchProfile()
      setVerifyStep('done')
      setVerifyMsg('Identity verified on-chain!')

    } catch (e) {
      setVerifyErr(e instanceof Error ? e.message : 'Verification failed')
      setVerifyStep('error')
    }
  }

  if (!ready || !authenticated || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-14 bg-white/90 backdrop-blur-md border-b border-neutral-100">
        <Link href="/" className="text-[14px] font-bold tracking-tight text-black">
          Nexash<span className="text-indigo-600">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-neutral-600 font-medium">@{profile.username}</span>
          {profile.verified && (
            <span className="text-[11px] bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full font-medium">
              ✓ KYC verified
            </span>
          )}
          {user?.wallet?.address && (
            <AddressDisplay address={user.wallet.address} truncate showCopy className="text-neutral-500" />
          )}
          <button onClick={logout} className="text-[11px] text-neutral-400 hover:text-neutral-600 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <div className="pt-14 max-w-3xl mx-auto px-6 py-8">

        {/* Profile card */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-[22px] font-bold text-black tracking-tight">@{profile.username}</h1>
                {profile.verified ? (
                  <span className="text-[11px] bg-green-50 text-green-600 border border-green-100 px-2.5 py-0.5 rounded-full font-medium">
                    KYC Level {profile.kycLevel} verified
                  </span>
                ) : (
                  <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-0.5 rounded-full font-medium">
                    Not verified
                  </span>
                )}
              </div>
              {user?.wallet?.address && (
                <AddressDisplay address={user.wallet.address} truncate={false} showCopy showExplorer className="text-neutral-400 text-[12px]" />
              )}
            </div>

            {/* Payment link */}
            <div className="text-right">
              <div className="text-[11px] text-neutral-400 mb-1">Your payment link</div>
              <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5">
                <span className="text-[12px] font-mono text-indigo-600">nexash/@{profile.username}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(`nexash/@${profile.username}`)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1"/>
                    <path d="M8 4V2a1 1 0 00-1-1H2a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="currentColor" strokeWidth="1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KYC Verification */}
        {!profile.verified && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-5">
            <h2 className="text-[15px] font-semibold text-black mb-1">Verify your identity</h2>
            <p className="text-[12px] text-neutral-500 mb-5">
              Complete KYC verification to receive ZK-verified payments. Uses your Binance KYC via NexaID zkTLS — no personal data on-chain.
            </p>

            {verifyStep === 'idle' && (
              <>
                {!isNexaIDInstalled() && (
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
                      <circle cx="8" cy="8" r="6.5" stroke="#d97706" strokeWidth="1"/>
                      <path d="M8 5v3.5M8 11h.01" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <div>
                      <p className="text-[12px] text-amber-700 font-medium mb-0.5">NexaID extension required</p>
                      <p className="text-[11px] text-amber-600">
                        Install the NexaID TransGate Chrome extension to generate zkTLS attestations.{' '}
                        <a href="https://docs.nexaid.io" target="_blank" rel="noopener noreferrer" className="underline">
                          Download here
                        </a>
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <button onClick={handleVerify} className="btn-primary text-[13px]">
                    Verify with Binance KYC
                  </button>
                  <div className="flex items-center gap-1.5 text-[12px] text-neutral-400">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1l1.5 4h4l-3.2 2.4 1.2 4L7 9l-3.5 2.4 1.2-4L1.5 5h4z" stroke="#9ca3af" strokeWidth="1"/>
                    </svg>
                    NexaID zkTLS · No personal data revealed
                  </div>
                </div>
              </>
            )}

            {(verifyStep === 'nexaid' || verifyStep === 'generating-proof' || verifyStep === 'submitting') && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-[13px] text-neutral-700">{verifyMsg}</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-1">
                  <div
                    className="bg-indigo-500 h-1 rounded-full transition-all duration-500"
                    style={{
                      width: verifyStep === 'nexaid' ? '25%' :
                             verifyStep === 'generating-proof' ? '65%' : '90%'
                    }}
                  />
                </div>
                <p className="text-[11px] text-neutral-400">Do not close this window</p>
              </div>
            )}

            {verifyStep === 'done' && (
              <div className="flex items-center gap-3 text-green-600">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" stroke="#16a34a" strokeWidth="1.2"/>
                  <path d="M5 9l3 3 5-5" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p className="text-[13px] font-medium">Identity verified on-chain</p>
                  {txHash && (
                    <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer"
                       className="text-[11px] text-indigo-500 hover:underline">
                      View transaction ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            {verifyStep === 'error' && (
              <div className="space-y-3">
                <p className="text-[12px] text-red-500">{verifyErr}</p>
                <button onClick={() => setVerifyStep('idle')} className="btn-secondary text-[12px]">
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Verified badge */}
        {profile.verified && (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l3.5 3.5L12 3" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-green-800">Identity verified</p>
                <p className="text-[11px] text-green-600">
                  KYC Level {profile.kycLevel} · UltraHonk proof on-chain · NexaID zkTLS attested
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-green-600">
              {profile.nullifier.slice(0, 10)}...
            </span>
          </div>
        )}

        {/* Incoming payments */}
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
            <h2 className="text-[14px] font-semibold text-black">Incoming payments</h2>
            <span className="text-[11px] text-neutral-400">{payments.length} total</span>
          </div>

          {payments.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-[13px] text-neutral-400 mb-1">No payments yet</p>
              <p className="text-[12px] text-neutral-300">
                Share your link <span className="font-mono text-indigo-400">nexash/@{profile.username}</span> to receive payments
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {payments.map(p => (
                <div key={p.txHash} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <a href={getExplorerTxUrl(p.txHash)} target="_blank" rel="noopener noreferrer"
                       className="text-[12px] font-mono text-indigo-600 hover:underline">
                      {p.txHash.slice(0, 10)}...{p.txHash.slice(-6)}
                    </a>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Block {p.blockNumber.toString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-semibold text-black">
                      {(Number(p.amount) / 1e6).toFixed(2)} USDC.e
                    </div>
                    <StatusBadge status="success" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
