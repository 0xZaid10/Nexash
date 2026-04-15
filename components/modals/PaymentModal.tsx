'use client'

import { useState } from 'react'
import { usePayment } from '@/hooks/usePayment'
import { CONTRACTS, TOKENS } from '@/lib/contracts/addresses'
import { getExplorerTxUrl } from '@/lib/contracts/client'
import type { TreasuryState } from '@/hooks/useTreasury'

interface PaymentModalProps {
  treasury:        TreasuryState
  treasuryAddress: string
  onClose:         () => void
}

import { publicClient } from '@/lib/contracts/client'
import { USER_REGISTRY_ABI, REGISTRY_ADDRESSES } from '@/lib/contracts/registries'

const TOKEN_OPTIONS = [
  { label: 'USDC',   address: TOKENS.USDC,   decimals: 6, hspCoin: 'USDC'   },
  { label: 'USDC.e', address: TOKENS.USDC_E, decimals: 6, hspCoin: 'USDC'   },
  { label: 'USDT',   address: TOKENS.USDT,   decimals: 6, hspCoin: 'USDT'   },
]

export function PaymentModal({ treasury, treasuryAddress, onClose }: PaymentModalProps) {
  const [recipient,      setRecipient]      = useState('')
  const [amount,         setAmount]         = useState('')
  const [tokenIndex,     setTokenIndex]     = useState(0)
  const [recipientStatus, setRecipientStatus] = useState<'idle'|'loading'|'verified'|'unverified'>('idle')
  const [recipientData,  setRecipientData]  = useState<{
    reportTxHash: string
    taskId:       string
    kycLevel:     number
  } | null>(null)

  const token = TOKEN_OPTIONS[tokenIndex]
  const { execute, reset, status, result, error, proof } = usePayment()

  const isIdle    = status === 'idle'
  const isRunning = status !== 'idle' && status !== 'success' && status !== 'error'
  const isSuccess = status === 'success'
  const isError   = status === 'error'

  // Auto-lookup recipient KYC data from NexashUserRegistry
  async function lookupRecipient(address: string) {
    if (!address || !address.startsWith('0x') || address.length !== 42) return
    setRecipientStatus('loading')
    try {
      const profile = await publicClient.readContract({
        address:      REGISTRY_ADDRESSES.USER_REGISTRY,
        abi:          USER_REGISTRY_ABI,
        functionName: 'getProfile',
        args:         [address as `0x${string}`],
      }) as unknown as {
        verified:     boolean
        kycLevel:     number
        reportTxHash: `0x${string}`
        taskId:       `0x${string}`
      }

      if (profile.verified && profile.reportTxHash !== '0x' + '0'.repeat(64)) {
        setRecipientData({
          reportTxHash: profile.reportTxHash,
          taskId:       profile.taskId,
          kycLevel:     profile.kycLevel,
        })
        setRecipientStatus('verified')
      } else {
        setRecipientData(null)
        setRecipientStatus('unverified')
      }
    } catch {
      setRecipientData(null)
      setRecipientStatus('unverified')
    }
  }

  const handleSubmit = async () => {
    if (!recipient || !amount || !recipientData) return
    const amountBigInt = BigInt(Math.round(parseFloat(amount) * 10 ** token.decimals))
    await execute({
      token:           token.address,
      recipient:       recipient as `0x${string}`,
      amount:          amountBigInt,
      amountHuman:     parseFloat(amount).toFixed(2),
      coin:            token.hspCoin,
      treasury,
      treasuryAddress,
      reportTxHash:    recipientData.reportTxHash,
      taskId:          recipientData.taskId,
      kycLevel:        recipientData.kycLevel,
    })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border w-full max-w-md shadow-card">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">New payment</h2>
          <button
            onClick={handleClose}
            disabled={isRunning}
            className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Form — only show when idle */}
          {isIdle && (
            <div className="space-y-4">
              <div>
                <label className="label">Recipient address</label>
                <div className="relative">
                  <input
                    className="input"
                    placeholder="0x..."
                    value={recipient}
                    onChange={e => {
                      setRecipient(e.target.value)
                      setRecipientStatus('idle')
                      setRecipientData(null)
                    }}
                    onBlur={e => lookupRecipient(e.target.value)}
                  />
                  {recipientStatus === 'loading' && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* KYC status indicator */}
                {recipientStatus === 'verified' && recipientData && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="#16a34a" strokeWidth="1"/>
                      <path d="M3 6l2 2 4-4" stroke="#16a34a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    KYC Level {recipientData.kycLevel} verified via NexaID · Attestation found on-chain
                  </div>
                )}
                {recipientStatus === 'unverified' && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="#d97706" strokeWidth="1"/>
                      <path d="M6 4v3M6 8.5h.01" stroke="#d97706" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                    Recipient has not completed NexaID KYC verification
                  </div>
                )}
              </div>

              <div>
                <label className="label">Amount</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="0.00"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <select
                    className="px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-[12px] font-medium text-neutral-700"
                    value={tokenIndex}
                    onChange={e => setTokenIndex(Number(e.target.value))}
                  >
                    {TOKEN_OPTIONS.map((t, i) => (
                      <option key={t.label} value={i}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Policy info */}
              {treasury.policy && (
                <div className="bg-surface-secondary rounded-lg p-3 text-xs text-text-secondary">
                  <div className="flex justify-between">
                    <span>Spending limit</span>
                    <span className="font-medium">{(Number(treasury.policy.spendingLimit) / 1e6).toFixed(2)} USDC.e</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Min KYC level</span>
                    <span className="font-medium">{treasury.policy.minKycLevel}</span>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  <strong>ZK proof required.</strong> Generating two UltraHonk proofs takes ~60 seconds.
                  Your data never leaves this device.
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!recipient || !amount || recipientStatus !== 'verified' || !recipientData}
                className="btn-primary w-full"
              >
                {recipientStatus === 'loading' ? 'Looking up KYC...' :
                 recipientStatus === 'unverified' ? 'Recipient not KYC verified' :
                 'Generate proof & pay'}
              </button>
            </div>
          )}

          {/* Proof generation progress */}
          {isRunning && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-text-primary mb-1">
                  {status === 'initializing'       ? 'Initializing ZK backend...' :
                   status === 'creating-hsp-mandate' ? 'Creating HSP mandate...' :
                   status === 'generating-proofs'  ? proof.stepLabel :
                   status === 'submitting-tx'      ? 'Submitting to HashKey Chain...' :
                   status === 'confirming'          ? 'Waiting for confirmation...' :
                   'Processing...'}
                </p>
                <p className="text-xs text-text-muted">Do not close this window</p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-surface-tertiary rounded-full h-1.5">
                <div
                  className="bg-brand-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${proof.state.progress}%` }}
                />
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {[
                  { key: 'creating-hsp-mandate',   label: 'Create HSP Cart Mandate' },
                  { key: 'computing-nullifier',     label: 'Compute nullifier' },
                  { key: 'generating-identity-proof', label: 'Generate identity ZK proof (~45s)' },
                  { key: 'generating-policy-proof', label: 'Generate policy ZK proof (~20s)' },
                  { key: 'submitting-tx',           label: 'Submit on-chain' },
                ].map((step) => {
                  const stepOrder = [
                    'creating-hsp-mandate',
                    'computing-nullifier',
                    'generating-identity-proof',
                    'verifying-identity',
                    'generating-policy-proof',
                    'verifying-policy',
                    'submitting-tx',
                    'confirming',
                    'success',
                  ]
                  const currentIdx = stepOrder.indexOf(
                    status === 'generating-proofs' ? proof.state.step : status
                  )
                  const stepIdx = stepOrder.indexOf(step.key)
                  const isDone = currentIdx > stepIdx
                  const isActive = currentIdx === stepIdx

                  return (
                    <div key={step.key} className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0
                        ${isDone ? 'bg-green-500' : isActive ? 'bg-brand-500' : 'bg-surface-tertiary border border-border'}`}>
                        {isDone && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      </div>
                      <span className={`text-xs ${isDone ? 'text-green-600' : isActive ? 'text-brand-600 font-medium' : 'text-text-muted'}`}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Success */}
          {isSuccess && result && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10l4 4 8-8" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">Payment confirmed</p>
                <p className="text-xs text-text-secondary">
                  {amount} {token.label} sent to {recipient.slice(0, 6)}...{recipient.slice(-4)}
                </p>
              </div>
              <div className="bg-surface-secondary rounded-lg p-3 text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Transaction</span>
                  <a
                    href={getExplorerTxUrl(result.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-brand-600 hover:underline"
                  >
                    {result.txHash.slice(0, 8)}...{result.txHash.slice(-6)} ↗
                  </a>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">ZK proof</span>
                  <span className="text-green-600 font-medium">UltraHonk verified</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">HSP mandate</span>
                  <span className="font-mono text-text-tertiary text-2xs">{result.hspMandateId.slice(0, 10)}...</span>
                </div>
              </div>
              <button onClick={handleClose} className="btn-primary w-full">
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 6v4M10 14h.01" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="8" stroke="#dc2626" strokeWidth="1.2"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">Payment failed</p>
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleClose} className="btn-secondary flex-1 text-xs">
                  Cancel
                </button>
                <button onClick={() => { reset(); }} className="btn-primary flex-1 text-xs">
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
