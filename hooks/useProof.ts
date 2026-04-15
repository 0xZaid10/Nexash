'use client'

import { useState, useCallback } from 'react'

export type ProofStep =
  | 'idle'
  | 'computing-nullifier'
  | 'generating-identity-proof'
  | 'verifying-identity'
  | 'generating-policy-proof'
  | 'verifying-policy'
  | 'done'
  | 'error'

export interface ProofState {
  step: ProofStep
  progress: number  // 0-100
  error: string | null
  identityProof: { proof: Uint8Array; publicInputs: string[] } | null
  policyProof: { proof: Uint8Array; publicInputs: string[] } | null
  nullifier: string | null
}

const STEP_PROGRESS: Record<ProofStep, number> = {
  idle:                       0,
  'computing-nullifier':      10,
  'generating-identity-proof': 30,
  'verifying-identity':       65,
  'generating-policy-proof':  70,
  'verifying-policy':         95,
  done:                       100,
  error:                      0,
}

const STEP_LABELS: Record<ProofStep, string> = {
  idle:                       'Ready to generate proof',
  'computing-nullifier':      'Computing nullifier...',
  'generating-identity-proof': 'Generating identity proof (this takes ~45 seconds)...',
  'verifying-identity':       'Verifying identity proof locally...',
  'generating-policy-proof':  'Generating policy proof (~20 seconds)...',
  'verifying-policy':         'Verifying policy proof locally...',
  done:                       'Both proofs verified',
  error:                      'Proof generation failed',
}

export function useProof() {
  const [state, setState] = useState<ProofState>({
    step: 'idle',
    progress: 0,
    error: null,
    identityProof: null,
    policyProof: null,
    nullifier: null,
  })

  const setStep = useCallback((step: ProofStep, extra?: Partial<ProofState>) => {
    setState((prev) => ({
      ...prev,
      step,
      progress: STEP_PROGRESS[step],
      error: step === 'error' ? extra?.error ?? 'Unknown error' : null,
      ...extra,
    }))
  }, [])

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      progress: 0,
      error: null,
      identityProof: null,
      policyProof: null,
      nullifier: null,
    })
  }, [])

  const stepLabel = STEP_LABELS[state.step]
  const isGenerating = state.step !== 'idle' && state.step !== 'done' && state.step !== 'error'
  const isDone = state.step === 'done'
  const isError = state.step === 'error'

  return { state, setStep, reset, stepLabel, isGenerating, isDone, isError }
}
