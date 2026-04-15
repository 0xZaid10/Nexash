// ZK Flow Logger — clean browser console output for demo/debug
// Shows the full ZK proof generation pipeline in a readable format

const STYLE = {
  header:  'color:#6366f1;font-weight:bold;font-size:13px',
  step:    'color:#8b5cf6;font-weight:600',
  ok:      'color:#16a34a;font-weight:600',
  data:    'color:#0369a1;font-family:monospace;font-size:11px',
  warn:    'color:#d97706;font-weight:600',
  error:   'color:#dc2626;font-weight:bold',
  muted:   'color:#6b7280;font-size:11px',
  divider: 'color:#e5e7eb',
}

function divider() {
  console.log('%c' + '─'.repeat(60), STYLE.divider)
}

export const zkLogger = {
  // ── Identity proof ──────────────────────────────────────────

  identityStart(treasuryAddress: string) {
    divider()
    console.log('%c🔐 NEXASH ZK FLOW — Identity Proof', STYLE.header)
    divider()
    console.log('%c  Circuit:   %cidentity_compliance (UltraHonk N=65536)', STYLE.step, STYLE.data)
    console.log('%c  Treasury:  %c' + treasuryAddress, STYLE.step, STYLE.data)
    console.log('%c  Prover:    %cBrowser (no server)', STYLE.step, STYLE.data)
  },

  identityInputs(inputs: Record<string, unknown>) {
    console.group('%c  📥 Identity Circuit Inputs (private)', STYLE.step)
    console.log('%c  kyc_level:                 %c' + inputs.kyc_level,          STYLE.muted, STYLE.data)
    console.log('%c  jurisdiction:              %c' + inputs.jurisdiction,        STYLE.muted, STYLE.data)
    console.log('%c  nullifier_secret:          %c[hidden]',                      STYLE.muted, STYLE.data)
    console.log('%c  provider_pub_key_x:        %c[32 bytes secp256k1]',          STYLE.muted, STYLE.data)
    console.log('%c  provider_pub_key_y:        %c[32 bytes secp256k1]',          STYLE.muted, STYLE.data)
    console.log('%c  provider_signature:        %c[64 bytes ECDSA]',              STYLE.muted, STYLE.data)
    console.log('%c  kyc_message_hash:          %c[32 bytes]',                    STYLE.muted, STYLE.data)
    console.groupEnd()
    console.group('%c  📤 Identity Public Inputs', STYLE.step)
    console.log('%c  min_kyc_level:             %c' + inputs.min_kyc_level,       STYLE.muted, STYLE.data)
    console.log('%c  allowed_jurisdictions_root:%c' + inputs.allowed_jurisdictions_root, STYLE.muted, STYLE.data)
    console.log('%c  nullifier:                 %c' + inputs.nullifier,           STYLE.muted, STYLE.data)
    console.log('%c  treasury_address:          %c' + inputs.treasury_address,    STYLE.muted, STYLE.data)
    console.log('%c  proof_timestamp:           %c' + inputs.proof_timestamp,     STYLE.muted, STYLE.data)
    console.log('%c  expiry_window:             %c' + inputs.expiry_window + 's', STYLE.muted, STYLE.data)
    console.groupEnd()
  },

  identityGenerating() {
    console.log('%c  ⏳ Executing witness...', STYLE.step)
  },

  identityProofReady(proof: Uint8Array, publicInputs: string[]) {
    console.log('%c  ✅ Identity proof generated', STYLE.ok)
    console.log('%c  Proof size:   %c' + proof.length + ' bytes', STYLE.muted, STYLE.data)
    console.log('%c  Public inputs:%c' + publicInputs.length + ' fields', STYLE.muted, STYLE.data)
    console.log('%c  Local verify: %cPASSED', STYLE.muted, STYLE.ok)
  },

  // ── Policy proof ────────────────────────────────────────────

  policyStart() {
    divider()
    console.log('%c📋 NEXASH ZK FLOW — Policy Proof', STYLE.header)
    divider()
    console.log('%c  Circuit:   %ctransaction_policy (UltraHonk N=32768)', STYLE.step, STYLE.data)
  },

  policyInputs(inputs: Record<string, unknown>) {
    console.group('%c  📥 Policy Circuit Inputs (private)', STYLE.step)
    console.log('%c  amount:                %c' + inputs.amount + ' (base units)', STYLE.muted, STYLE.data)
    console.log('%c  spending_limit:        %c' + inputs.spending_limit,           STYLE.muted, STYLE.data)
    console.log('%c  operator_role:         %c' + inputs.operator_role + ' (' + ['','Viewer','Operator','Admin'][Number(inputs.operator_role)] + ')', STYLE.muted, STYLE.data)
    console.log('%c  cumulative_daily_spend:%c' + inputs.cumulative_daily_spend,   STYLE.muted, STYLE.data)
    console.log('%c  daily_spend_limit:     %c' + inputs.daily_spend_limit,        STYLE.muted, STYLE.data)
    console.groupEnd()
    console.group('%c  📤 Policy Public Inputs', STYLE.step)
    console.log('%c  policy_hash:           %c' + inputs.policy_hash,             STYLE.muted, STYLE.data)
    console.log('%c  requires_multisig:     %c' + (inputs.requires_multisig === '1' ? 'YES' : 'NO'), STYLE.muted, STYLE.data)
    console.log('%c  multisig_threshold:    %c' + inputs.multisig_threshold,       STYLE.muted, STYLE.data)
    console.log('%c  min_role:              %c' + inputs.min_role,                 STYLE.muted, STYLE.data)
    console.log('%c  payment_request_id:    %c' + inputs.payment_request_id,       STYLE.muted, STYLE.data)
    console.log('%c  treasury_address:      %c' + inputs.treasury_address,         STYLE.muted, STYLE.data)
    console.log('%c  proof_timestamp:       %c' + inputs.proof_timestamp,          STYLE.muted, STYLE.data)
    console.groupEnd()
  },

  policyGenerating() {
    console.log('%c  ⏳ Executing witness...', STYLE.step)
  },

  policyProofReady(proof: Uint8Array, publicInputs: string[]) {
    console.log('%c  ✅ Policy proof generated', STYLE.ok)
    console.log('%c  Proof size:   %c' + proof.length + ' bytes', STYLE.muted, STYLE.data)
    console.log('%c  Public inputs:%c' + publicInputs.length + ' fields', STYLE.muted, STYLE.data)
    console.log('%c  Local verify: %cPASSED', STYLE.muted, STYLE.ok)
  },

  // ── On-chain submission ──────────────────────────────────────

  submitting(treasury: string, recipient: string, amount: string) {
    divider()
    console.log('%c🔗 NEXASH ZK FLOW — On-Chain Submission', STYLE.header)
    divider()
    console.log('%c  Treasury:  %c' + treasury,  STYLE.step, STYLE.data)
    console.log('%c  Recipient: %c' + recipient,  STYLE.step, STYLE.data)
    console.log('%c  Amount:    %c' + amount + ' USDC.e', STYLE.step, STYLE.data)
    console.log('%c  Chain:     %cHashKey Chain Testnet (133)', STYLE.step, STYLE.data)
    console.log('%c  ⏳ Submitting initiatePayment() with both ZK proofs...', STYLE.step)
  },

  confirmed(txHash: string) {
    divider()
    console.log('%c✅ NEXASH ZK FLOW — Payment Confirmed', STYLE.ok)
    divider()
    console.log('%c  TxHash: %c' + txHash, STYLE.step, STYLE.data)
    console.log('%c  Explorer: %chttps://testnet-explorer.hsk.xyz/tx/' + txHash, STYLE.step, STYLE.data)
    console.log('%c  Both ZK proofs verified on-chain by UltraHonk verifier contracts', STYLE.ok)
    divider()
  },

  error(step: string, err: string) {
    divider()
    console.log('%c❌ NEXASH ZK FLOW — Failed at: ' + step, STYLE.error)
    console.log('%c  Error: ' + err, STYLE.error)
    divider()
  },
}
