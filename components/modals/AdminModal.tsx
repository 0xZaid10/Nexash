'use client'

import { useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { createWalletClient, custom, parseUnits } from 'viem'
import { hashkeyTestnet, getExplorerTxUrl } from '@/lib/contracts/client'
import { ZK_TREASURY_ABI } from '@/lib/contracts/abis'
import type { TreasuryState } from '@/hooks/useTreasury'

type AdminTab = 'roles' | 'policy' | 'tokens' | 'pause'

interface AdminModalProps {
  treasury:        TreasuryState
  treasuryAddress: string
  onClose:         () => void
  onRefresh:       () => void
}

async function computePolicyHash(
  spendingLimit:     bigint,
  dailySpendLimit:   bigint,
  multisigThreshold: bigint,
  minRole:           bigint,
  treasuryAddress:   string
): Promise<`0x${string}`> {
  const { Barretenberg } = await import('@aztec/bb.js')
  const api = await Barretenberg.new({ threads: 1 })
  function toField(v: bigint): Uint8Array {
    const buf = new Uint8Array(32)
    let val = v
    for (let i = 31; i >= 0; i--) { buf[i] = Number(val & 0xffn); val >>= 8n }
    return buf
  }
  const result = await api.pedersenHash({
    inputs: [
      toField(spendingLimit),
      toField(dailySpendLimit),
      toField(multisigThreshold),
      toField(minRole),
      toField(BigInt(treasuryAddress)),
    ],
    hashIndex: 0,
  })
  await api.destroy()
  return ('0x' + Buffer.from(result.hash).toString('hex')) as `0x${string}`
}

export function AdminModal({ treasury, treasuryAddress, onClose, onRefresh }: AdminModalProps) {
  const [tab,     setTab]     = useState<AdminTab>('roles')
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')
  const [txHash,  setTxHash]  = useState('')
  const { wallets } = useWallets()

  // Role state
  const [roleAddr,  setRoleAddr]  = useState('')
  const [roleValue, setRoleValue] = useState<1 | 2 | 3>(2)

  // Policy state — pre-filled from current policy
  const [spendLimit,  setSpendLimit]  = useState(treasury.policy ? (Number(treasury.policy.spendingLimit) / 1e6).toString() : '10000')
  const [dailyLimit,  setDailyLimit]  = useState(treasury.policy ? (Number(treasury.policy.dailySpendLimit) / 1e6).toString() : '50000')
  const [threshold,   setThreshold]   = useState(treasury.policy?.multisigThreshold.toString() ?? '1')
  const [minKyc,      setMinKyc]      = useState(treasury.policy?.minKycLevel.toString() ?? '2')
  const [minRole,     setMinRole]     = useState(treasury.policy?.minRole.toString() ?? '1')
  const [computing,   setComputing]   = useState(false)
  const [computedHash, setComputedHash] = useState('')

  // Token state
  const [tokenAddr, setTokenAddr] = useState('')

  async function getWC() {
    const wallet   = wallets[0]
    const provider = await wallet.getEthereumProvider()
    return createWalletClient({
      account:   wallet.address as `0x${string}`,
      chain:     hashkeyTestnet,
      transport: custom(provider),
    })
  }

  async function send(functionName: string, args: unknown[]) {
    setLoading(true)
    setMsg('')
    setTxHash('')
    try {
      const wc   = await getWC()
      const hash = await wc.writeContract({
        address:      treasuryAddress as `0x${string}`,
        abi:          ZK_TREASURY_ABI,
        functionName: functionName as never,
        args:         args as never,
      })
      setTxHash(hash)
      setMsg('Transaction submitted')
      setTimeout(onRefresh, 3000)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdatePolicy() {
    setComputing(true)
    setMsg('')
    setComputedHash('')
    try {
      const sl  = parseUnits(spendLimit, 6)
      const dl  = parseUnits(dailyLimit, 6)
      const thr = BigInt(threshold)
      const mr  = BigInt(minRole)

      setMsg('Computing policy hash via Barretenberg...')
      const hash = await computePolicyHash(sl, dl, thr, mr, treasuryAddress)
      setComputedHash(hash)
      setMsg('Submitting updatePolicy on-chain...')

      const wc = await getWC()
      const tx = await wc.writeContract({
        address:      treasuryAddress as `0x${string}`,
        abi:          ZK_TREASURY_ABI,
        functionName: 'updatePolicy',
        args: [
          sl,
          dl,
          Number(threshold),
          Number(minKyc),
          Number(minRole),
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          hash,
        ],
      })
      setTxHash(tx)
      setMsg('Policy updated successfully')
      setTimeout(onRefresh, 3000)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Policy update failed')
    } finally {
      setComputing(false)
      setLoading(false)
    }
  }

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'roles',  label: 'Roles'     },
    { key: 'policy', label: 'Policy'    },
    { key: 'tokens', label: 'Tokens'    },
    { key: 'pause',  label: 'Emergency' },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 w-full max-w-md shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="text-[14px] font-semibold text-black">Admin panel</h2>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
              {treasuryAddress.slice(0,10)}...{treasuryAddress.slice(-6)}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-100 px-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setMsg(''); setTxHash('') }}
              className={`text-[12px] py-3 px-1 mr-5 border-b-2 transition-colors
                ${tab === t.key
                  ? 'border-indigo-500 text-indigo-600 font-medium'
                  : 'border-transparent text-neutral-500 hover:text-black'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">

          {/* Roles */}
          {tab === 'roles' && (
            <>
              <div>
                <label className="label">Wallet address</label>
                <input className="input" placeholder="0x..." value={roleAddr}
                  onChange={e => setRoleAddr(e.target.value)} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={roleValue}
                  onChange={e => setRoleValue(Number(e.target.value) as 1|2|3)}>
                  <option value={1}>1 — Viewer (read-only)</option>
                  <option value={2}>2 — Operator (can pay)</option>
                  <option value={3}>3 — Admin (full control)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button disabled={!roleAddr || loading}
                  onClick={() => send('grantRole', [roleAddr, roleValue])}
                  className="btn-primary flex-1 text-[12px]">
                  Grant role
                </button>
                <button disabled={!roleAddr || loading}
                  onClick={() => send('revokeRole', [roleAddr])}
                  className="btn-secondary flex-1 text-[12px]">
                  Revoke
                </button>
              </div>
            </>
          )}

          {/* Policy */}
          {tab === 'policy' && (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] text-amber-700">
                Updating policy recomputes the pedersen hash automatically and stores it on-chain.
                All subsequent ZK proofs will use the new policy values.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Per-tx limit (USDC.e)</label>
                  <input className="input" type="number" value={spendLimit}
                    onChange={e => setSpendLimit(e.target.value)} disabled={computing}/>
                </div>
                <div>
                  <label className="label">Daily limit (USDC.e)</label>
                  <input className="input" type="number" value={dailyLimit}
                    onChange={e => setDailyLimit(e.target.value)} disabled={computing}/>
                </div>
                <div>
                  <label className="label">Multisig threshold</label>
                  <select className="input" value={threshold}
                    onChange={e => setThreshold(e.target.value)} disabled={computing}>
                    <option value="1">1 — Single sig</option>
                    <option value="2">2 of n</option>
                    <option value="3">3 of n</option>
                  </select>
                </div>
                <div>
                  <label className="label">Min operator role</label>
                  <select className="input" value={minRole}
                    onChange={e => setMinRole(e.target.value)} disabled={computing}>
                    <option value="1">1 — Viewer</option>
                    <option value="2">2 — Operator</option>
                    <option value="3">3 — Admin</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Min KYC level</label>
                <select className="input" value={minKyc}
                  onChange={e => setMinKyc(e.target.value)} disabled={computing}>
                  <option value="1">1 — Basic</option>
                  <option value="2">2 — Intermediate</option>
                  <option value="3">3 — Advanced</option>
                  <option value="4">4 — Premium</option>
                </select>
              </div>
              {computedHash && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-indigo-500 font-medium mb-0.5">Computed policy hash</p>
                  <p className="text-[11px] font-mono text-indigo-700 break-all">{computedHash}</p>
                </div>
              )}
              <button
                onClick={handleUpdatePolicy}
                disabled={computing || loading}
                className="btn-primary w-full text-[12px]"
              >
                {computing ? 'Computing hash & updating...' : 'Update policy'}
              </button>
            </>
          )}

          {/* Tokens */}
          {tab === 'tokens' && (
            <>
              <div>
                <label className="label">Token contract address</label>
                <input className="input" placeholder="0x..." value={tokenAddr}
                  onChange={e => setTokenAddr(e.target.value)} />
              </div>
              {treasury.allowedTokens.length > 0 && (
                <div>
                  <label className="label">Currently allowed</label>
                  <div className="space-y-1.5">
                    {treasury.allowedTokens.map(t => (
                      <div key={t} className="flex items-center justify-between px-3 py-2 bg-neutral-50 border border-neutral-100 rounded-lg">
                        <span className="text-[11px] font-mono text-neutral-600">{t.slice(0,10)}...{t.slice(-6)}</span>
                        <button onClick={() => send('removeToken', [t])} disabled={loading}
                          className="text-[11px] text-red-500 hover:text-red-600">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button disabled={!tokenAddr || loading}
                onClick={() => send('allowToken', [tokenAddr])}
                className="btn-primary w-full text-[12px]">
                Allow token
              </button>
            </>
          )}

          {/* Emergency */}
          {tab === 'pause' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${treasury.paused
                ? 'bg-orange-50 border-orange-200'
                : 'bg-green-50 border-green-200'}`}>
                <p className={`text-[13px] font-medium mb-1 ${treasury.paused ? 'text-orange-700' : 'text-green-700'}`}>
                  Treasury is {treasury.paused ? 'paused' : 'active'}
                </p>
                <p className={`text-[11px] ${treasury.paused ? 'text-orange-600' : 'text-green-600'}`}>
                  {treasury.paused
                    ? 'All payments blocked. Only admin functions available.'
                    : 'All operations running normally.'}
                </p>
              </div>
              {treasury.paused ? (
                <button disabled={loading} onClick={() => send('unpause', [])}
                  className="btn-primary w-full text-[12px]">
                  Unpause treasury
                </button>
              ) : (
                <button disabled={loading} onClick={() => send('pause', [])}
                  className="w-full px-5 py-2.5 bg-red-600 text-white text-[12px] font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">
                  Emergency pause
                </button>
              )}
            </div>
          )}

          {/* Status */}
          {msg && (
            <div className={`text-[11px] p-3 rounded-lg ${
              msg.includes('failed') || msg.includes('Error')
                ? 'bg-red-50 text-red-600 border border-red-100'
                : 'bg-green-50 text-green-600 border border-green-100'}`}>
              {msg}
              {txHash && (
                <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer"
                   className="block mt-1 text-indigo-500 hover:underline font-mono">
                  {txHash.slice(0,10)}...{txHash.slice(-6)} ↗
                </a>
              )}
            </div>
          )}

          {(loading || computing) && !msg && (
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <div className="w-3 h-3 border border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Processing...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
