import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Footer'

const steps = [
  {
    n: '01',
    title: 'Deploy your treasury',
    desc: 'Call TreasuryFactory.deployTreasury() in one transaction. Each organization gets a completely isolated contract instance — separate funds, roles, policy, and token allowlist. No shared state, no dependencies.',
    detail: 'Your treasury is deployed with an admin address, spending limits, KYC requirements, and allowed tokens set upfront. The factory maintains a registry but has no control over individual treasuries.',
    tag: 'On-chain',
  },
  {
    n: '02',
    title: 'Configure compliance policy',
    desc: 'Set your spending limit per transaction, daily cap across all operators, minimum KYC level for recipients, jurisdiction merkle root, and multisig threshold. All stored on-chain in PolicyEngine.',
    detail: 'The policy hash is computed as pedersen_hash([spending_limit, daily_limit, threshold, min_role, treasury_address]). This hash is what the ZK circuit commits to — changing policy immediately invalidates all existing proofs.',
    tag: 'Policy',
  },
  {
    n: '03',
    title: 'Generate ZK proofs in browser',
    desc: 'Two independent Noir circuits run in your browser via Barretenberg WASM. The identity circuit verifies KYC compliance with a real secp256k1 signature verification inside the proof. The policy circuit verifies spending rules.',
    detail: 'Identity proof: 9,024 bytes, N=65,536. Policy proof: 8,640 bytes, N=32,768. Both use UltraHonk — no trusted setup ceremony required. Your private data never leaves the device.',
    tag: 'ZK Proof',
  },
  {
    n: '04',
    title: 'On-chain verification',
    desc: 'ZKTreasury.initiatePayment() runs 12 sequential checks: both proofs cryptographically verified, nullifier unused, timestamp fresh, treasury address bound, policy hash matches, KYC gate passes, balance sufficient.',
    detail: 'If every check passes, funds transfer via safeTransfer. If any check fails, the entire transaction reverts. No partial state. The nullifier is stored permanently — the same identity proof cannot be replayed.',
    tag: 'Smart contract',
  },
  {
    n: '05',
    title: 'Payment executes + audit record created',
    desc: 'Tokens transfer to the recipient. HSPAdapter creates an on-chain payment record with a 7-state lifecycle. An HSP Cart Mandate is created via HashKey Settlement Protocol for structured audit documentation.',
    detail: 'HSP states: PAYMENT_REQUIRED → SUBMITTED → VERIFIED → PROCESSING → INCLUDED → SUCCESSFUL. Each state transition emits an on-chain event. Terminal states are immutable — tamper-proof audit trail.',
    tag: 'Settlement',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-16">

        {/* Header */}
        <div className="border-b border-neutral-100 bg-neutral-50 py-16 px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-4">
              How it works
            </div>
            <h1 className="text-[44px] font-bold text-black tracking-[-1.5px] leading-[1.1] mb-4">
              Five steps. No middleman.<br />No personal data on-chain.
            </h1>
            <p className="text-[15px] text-neutral-500 leading-relaxed max-w-xl">
              From treasury deployment to confirmed payment with a full ZK-verified compliance trail
              and HSP audit record — all in one flow.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto px-12 py-16">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-8 bottom-8 w-px bg-neutral-100" />

            <div className="flex flex-col gap-0">
              {steps.map((step, i) => (
                <div key={step.n} className="flex gap-8 pb-12 last:pb-0">
                  {/* Circle */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-10 h-10 rounded-full bg-black text-white text-[13px] font-bold flex items-center justify-center z-10 relative">
                      {i + 1}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1.5 pb-4">
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-[20px] font-bold text-black tracking-tight">{step.title}</h2>
                      <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                        {step.tag}
                      </span>
                    </div>
                    <p className="text-[14px] text-neutral-600 leading-relaxed mb-4">{step.desc}</p>
                    <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4">
                      <p className="text-[13px] text-neutral-500 leading-relaxed font-mono">{step.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* E2E proof link */}
          <div className="mt-8 p-5 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-green-800 mb-0.5">This entire flow has been verified end-to-end</div>
              <div className="text-[12px] text-green-600">Real ZK proofs · Real token transfer · Confirmed on HashKey Chain</div>
            </div>
            <a
              href="https://testnet-explorer.hsk.xyz/tx/0xe4ce2f122dee2aeb6e80a2b7b52c6157bfecf0e6a72303fb97ba4ae3a7519964"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[12px] font-medium text-green-700 hover:underline flex items-center gap-1"
            >
              View transaction ↗
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
