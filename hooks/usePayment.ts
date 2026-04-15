'use client'

import { useState, useCallback } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { createWalletClient, custom, parseUnits, encodeFunctionData } from 'viem'
import { hashkeyTestnet } from '@/lib/contracts/client'
import { CONTRACTS, TOKENS } from '@/lib/contracts/addresses'
import { ZK_TREASURY_ABI } from '@/lib/contracts/abis'
import { initBarretenberg } from '@/lib/zk/barretenberg'
import { buildIdentityInputs, generateIdentityProof } from '@/lib/zk/identity'
import { buildPolicyInputs, generatePolicyProof } from '@/lib/zk/policy'
import { zkLogger } from '@/lib/zk/logger'
import { createHSPOrder } from '@/lib/hsp/client'
import { useProof } from './useProof'
import type { TreasuryState } from './useTreasury'

export type PaymentStatus =
  | 'idle'
  | 'initializing'
  | 'creating-hsp-mandate'
  | 'generating-proofs'
  | 'submitting-tx'
  | 'confirming'
  | 'success'
  | 'error'

export interface PaymentParams {
  token:           `0x${string}`
  recipient:       `0x${string}`
  amount:          bigint
  amountHuman:     string
  coin:            string
  treasury:        TreasuryState
  treasuryAddress: string
  // Recipient's NexaID attestation — proves their KYC on HashKey Chain
  reportTxHash:    string   // from recipient's NexaID attestation
  taskId:          string   // from recipient's NexaID attestation
  kycLevel:        number   // recipient's KYC level (1-4)
}

export interface PaymentResult {
  txHash: string
  paymentRequestId: string
  hspMandateId: string
}

export function usePayment() {
  const { user } = usePrivy()
  const { wallets } = useWallets()
  const proof = useProof()
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (params: PaymentParams) => {
    setStatus('idle')
    setError(null)
    setResult(null)
    proof.reset()

    try {
      const wallet = wallets[0]
      if (!wallet) throw new Error('No wallet connected')

      // ── 1. Initialize Barretenberg ──────────────────────
      setStatus('initializing')
      await initBarretenberg()

      // ── 2. Generate IDs ─────────────────────────────────
      const timestamp = Math.floor(Date.now() / 1000)
      const paymentRequestId = generatePaymentRequestId()
      const cartMandateId = generatePaymentRequestId()

      // ── 3. Create HSP Cart Mandate ───────────────────────
      setStatus('creating-hsp-mandate')
      await createHSPOrder(
        cartMandateId,
        paymentRequestId,
        params.token,
        CONTRACTS.ZK_TREASURY,
        params.amountHuman,
        params.coin
      ).catch((e) => {
        // Non-fatal — HSP mandate creation may fail on testnet token mismatch
        // ZK proof + on-chain payment still proceeds
        console.warn('HSP mandate warning:', e.message)
      })

      // ── 4. Generate ZK proofs ────────────────────────────
      setStatus('generating-proofs')

      // Identity proof — uses recipient's real NexaID attestation
      // reportTxHash is the on-chain trustless anchor from NexaID
      proof.setStep('generating-identity-proof')
      const idInputs = await buildIdentityInputs(
        params.kycLevel,          // recipient's KYC level from NexaID
        344,                      // jurisdiction (open for testnet)
        params.reportTxHash,      // NexaID reportTxHash — on-chain attestation
        params.taskId,            // NexaID taskId
        params.treasuryAddress,   // bound to this treasury
      )
      const idProof = await generateIdentityProof(idInputs)
      proof.setStep('verifying-identity', { identityProof: idProof })

      // Policy proof — uses on-chain policy hash from PolicyEngine
      proof.setStep('generating-policy-proof')
      const policy = params.treasury.policy!
      const policyHash = policy.policyHash ??
        '0x25ad373500f08fd74a357c919ebd2e141dd71cb00636cf963623ca8389916f11'
      const polInputs = buildPolicyInputs(
        params.amount,
        policy.spendingLimit,
        policy.dailySpendLimit,
        0n,
        policy.multisigThreshold,
        policy.minRole,
        policyHash,
        paymentRequestId,
        params.treasuryAddress,
        timestamp,
        // Circuit only accepts operator_role 1 or 2 (Admin=3 must pass as 2)
        Math.min(params.treasury.currentUserRole || 2, 2),
      )
      const polProof = await generatePolicyProof(polInputs)
      proof.setStep('verifying-policy', { policyProof: polProof })
      proof.setStep('done', { identityProof: idProof, policyProof: polProof })

      // ── 5. Submit on-chain ───────────────────────────────
      setStatus('submitting-tx')
      zkLogger.submitting(
        params.treasuryAddress,
        params.recipient,
        (Number(params.amount) / 1e6).toFixed(2)
      )

      const provider = await wallet.getEthereumProvider()
      const walletClient = createWalletClient({
        account:   wallet.address as `0x${string}`,
        chain:     hashkeyTestnet,
        transport: custom(provider),
      })

      const idProofHex  = ('0x' + Buffer.from(idProof.proof).toString('hex'))  as `0x${string}`
      const polProofHex = ('0x' + Buffer.from(polProof.proof).toString('hex')) as `0x${string}`

      const txHash = await walletClient.writeContract({
        address:      params.treasuryAddress as `0x${string}`,
        abi:          ZK_TREASURY_ABI,
        functionName: 'initiatePayment',
        args: [
          params.token,
          params.recipient,
          params.amount,
          paymentRequestId as `0x${string}`,
          idProofHex,
          idProof.publicInputs as `0x${string}`[],
          polProofHex,
          polProof.publicInputs as `0x${string}`[],
        ],
      })

      // ── 6. Confirm ───────────────────────────────────────
      setStatus('confirming')
      zkLogger.confirmed(txHash)
      setResult({ txHash, paymentRequestId, hspMandateId: cartMandateId })
      setStatus('success')

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed'
      zkLogger.error('payment', msg)
      setError(msg)
      proof.setStep('error', { error: msg })
      setStatus('error')
    }
  }, [wallets, proof])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResult(null)
    proof.reset()
  }, [proof])

  return { execute, reset, status, result, error, proof }
}

function generatePaymentRequestId(): `0x${string}` {
  const ts = Math.floor(Date.now() / 1000)
  const rnd = Math.floor(Math.random() * 0xffffff)
  const hex = `${ts.toString(16)}${rnd.toString(16).padStart(6, '0')}`
  return `0x${hex.padStart(64, '0')}` as `0x${string}`
}
