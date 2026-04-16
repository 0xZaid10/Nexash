'use client'

import { useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { createWalletClient, custom, parseUnits } from 'viem'
import { hashkeyTestnet, getExplorerAddressUrl } from '@/lib/contracts/client'
import { TOKENS, EXPLORER } from '@/lib/contracts/addresses'
import { ERC20_ABI } from '@/lib/contracts/abis'
import type { TreasuryState } from '@/hooks/useTreasury'

function fmt(amount: bigint, decimals = 6): string {
  const n = Number(amount) / 10 ** decimals
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface TreasuryOverviewProps {
  treasury:       TreasuryState
  treasuryAddress: string
  onNewPayment:   () => void
  onAdmin:        () => void
  onRefresh:      () => void
}

export function TreasuryOverview({
  treasury,
  treasuryAddress,
  onNewPayment,
  onAdmin,
  onRefresh,
}: TreasuryOverviewProps) {
  const { user } = usePrivy()
  const { wallets } = useWallets()
  const policy = treasury.policy

  const [showDeposit, setShowDeposit] = useState(false)
  const [depositAmt,  setDepositAmt]  = useState('')
  const [depositing,  setDepositing]  = useState(false)
  const [depositErr,  setDepositErr]  = useState('')

  async function handleDeposit() {
    if (!depositAmt) return
    setDepositing(true)
    setDepositErr('')
    try {
      const wallet   = wallets[0]
      const provider = await wallet.getEthereumProvider()
      const wc = createWalletClient({
        account:   wallet.address as `0x${string}`,
        chain:     hashkeyTestnet,
        transport: custom(provider),
      })
      await wc.writeContract({
        address:      TOKENS.USDC_E,
        abi:          ERC20_ABI,
        functionName: 'transfer',
        args:         [treasuryAddress as `0x${string}`, parseUnits(depositAmt, 6)],
      })
      setShowDeposit(false)
      setDepositAmt('')
      setTimeout(onRefresh, 3000)
    } catch (e) {
      setDepositErr(e instanceof Error ? e.message : 'Deposit failed')
    } finally {
      setDepositing(false)
    }
  }

  const metrics = [
    {
      label: 'USDC.e balance',
      value: fmt(treasury.balance),
      sub:   'Available in treasury',
    },
    {
      label: 'Spending limit',
      value: policy ? fmt(policy.spendingLimit) : '—',
      sub:   'Per transaction max',
    },
    {
      label: 'Daily limit',
      value: policy ? fmt(policy.dailySpendLimit) : '—',
      sub:   'Across all operators',
    },
    {
      label: 'Members',
      value: treasury.memberCount.toString(),
      sub:   `${treasury.isAdmin ? '1 admin' : 'view only'}`,
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-black">{treasury.name}</h1>
          <a
            href={getExplorerAddressUrl(treasuryAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-neutral-400 hover:text-indigo-500 font-mono transition-colors"
          >
            {treasuryAddress.slice(0, 10)}...{treasuryAddress.slice(-6)} ↗
          </a>
        </div>
        <div className="flex gap-2">
          {/* Deposit button — always visible for admins/operators */}
          {treasury.isOperator && (
            <button
              onClick={() => setShowDeposit(!showDeposit)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-neutral-600 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Deposit
            </button>
          )}
          {treasury.isAdmin && (
            <button onClick={onAdmin} className="px-3 py-1.5 text-[12px] text-neutral-600 border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors">
              Admin
            </button>
          )}
          {treasury.isOperator && (
            <button
              onClick={onNewPayment}
              className="px-4 py-1.5 text-[12px] bg-black text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors"
            >
              New payment
            </button>
          )}
        </div>
      </div>

      {/* Deposit panel */}
      {showDeposit && (
        <div className="mb-5 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="text-[11px] font-medium text-indigo-700 mb-1 block">
              Deposit USDC.e to treasury
            </label>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-[13px]"
                type="number"
                placeholder="Amount"
                min="0"
                step="0.01"
                value={depositAmt}
                onChange={e => setDepositAmt(e.target.value)}
              />
              <span className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-[12px] text-neutral-500 font-medium">
                USDC.e
              </span>
            </div>
            {depositErr && <p className="text-[11px] text-red-500 mt-1">{depositErr}</p>}
            <p className="text-[11px] text-indigo-600 mt-1">
              Transfers USDC.e from your wallet to the treasury contract
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowDeposit(false); setDepositAmt(''); setDepositErr('') }}
              className="px-3 py-2 text-[12px] border border-neutral-200 bg-white rounded-lg text-neutral-500"
            >
              Cancel
            </button>
            <button
              onClick={handleDeposit}
              disabled={!depositAmt || depositing}
              className="px-4 py-2 text-[12px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {depositing ? 'Depositing...' : 'Deposit'}
            </button>
          </div>
        </div>
      )}

      {/* Low balance warning */}
      {treasury.balance === 0n && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <circle cx="8" cy="8" r="6.5" stroke="#d97706" strokeWidth="1"/>
            <path d="M8 5v3.5M8 11h.01" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <p className="text-[12px] text-amber-700">
            Treasury has no balance. Deposit USDC.e before initiating payments.
          </p>
          {treasury.isOperator && (
            <button
              onClick={() => setShowDeposit(true)}
              className="ml-auto text-[11px] text-amber-700 font-medium underline"
            >
              Deposit now
            </button>
          )}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {metrics.map((m) => (
          <div key={m.label} className="bg-neutral-50 rounded-xl p-4">
            <div className="text-[11px] text-neutral-400 mb-1">{m.label}</div>
            <div className="text-[20px] font-bold text-black tracking-tight">{m.value}</div>
            <div className="text-[10px] text-neutral-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Policy + jurisdiction bar */}
      {policy && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-lg">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            <span className="text-[11px] text-indigo-600 font-medium">Policy hash:</span>
            <span className="text-[11px] font-mono text-indigo-500">
              {policy.policyHash.slice(0, 14)}...{policy.policyHash.slice(-6)}
            </span>
          </div>
          <div className="w-px h-3 bg-indigo-200" />
          <span className="text-[11px] text-indigo-500">Min KYC {policy.minKycLevel}</span>
          <div className="w-px h-3 bg-indigo-200" />
          <span className="text-[11px] text-indigo-500">
            {policy.multisigThreshold === 1 ? 'Single sig' : `${policy.multisigThreshold}-of-n multisig`}
          </span>
          <div className="w-px h-3 bg-indigo-200" />
          <span className="text-[11px] text-indigo-500">
            Jurisdiction: {
              policy.allowedJurisdictionsRoot === '0x' + '0'.repeat(64)
                ? 'Open (all countries)'
                : `Restricted · ${policy.allowedJurisdictionsRoot.slice(0, 8)}...`
            }
          </span>
        </div>
      )}
    </div>
  )
}
