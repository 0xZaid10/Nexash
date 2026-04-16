import { getPolBackend, getPolNoir } from './barretenberg'
import { zkLogger } from './logger'
import type { ProofResult } from './identity'

export interface PolicyProofInputs {
  amount:                 string
  spending_limit:         string
  operator_role:          string
  cumulative_daily_spend: string
  daily_spend_limit:      string
  policy_hash:            string
  requires_multisig:      string
  multisig_threshold:     string
  min_role:               string
  payment_request_id:     string
  treasury_address:       string
  proof_timestamp:        string
}

export function buildPolicyInputs(
  amount:            bigint,
  spendingLimit:     bigint,
  dailySpendLimit:   bigint,
  dailySpend:        bigint,
  multisigThreshold: number,
  minRole:           number,
  policyHash:        string,
  paymentRequestId:  string,
  treasuryAddress:   string,
  proofTimestamp:    number,
  operatorRole:      number = 2,
): PolicyProofInputs {
  const requiresMultisig = amount > spendingLimit / 2n ? '1' : '0'

  return {
    amount:                 amount.toString(),
    spending_limit:         spendingLimit.toString(),
    operator_role:          operatorRole.toString(),
    cumulative_daily_spend: dailySpend.toString(),
    daily_spend_limit:      dailySpendLimit.toString(),
    policy_hash:            policyHash,
    requires_multisig:      requiresMultisig,
    multisig_threshold:     multisigThreshold.toString(),
    min_role:               minRole.toString(),
    payment_request_id:     paymentRequestId,
    treasury_address:       BigInt(treasuryAddress).toString(),
    proof_timestamp:        proofTimestamp.toString(),
  }
}

export async function generatePolicyProof(
  inputs: PolicyProofInputs
): Promise<ProofResult> {
  zkLogger.policyStart()
  zkLogger.policyInputs(inputs as unknown as Record<string, unknown>)
  zkLogger.policyGenerating()

  const noir    = getPolNoir()
  const backend = getPolBackend()

  const { witness } = await noir.execute(inputs as unknown as import("@noir-lang/noir_js").InputMap)

  const { proof, publicInputs } = await backend.generateProof(witness, {
    verifierTarget: 'evm',
  })

  const verified = await backend.verifyProof(
    { proof, publicInputs },
    { verifierTarget: 'evm' }
  )

  if (!verified) throw new Error('Policy proof failed local verification')

  zkLogger.policyProofReady(proof, publicInputs)
  return { proof, publicInputs }
}
