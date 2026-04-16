const solutions = [
  {
    num: '01',
    title: 'ZK identity verification',
    body: 'Every recipient proves KYC compliance with a cryptographic proof. No personal data touches the blockchain. Verified on-chain by a trustless UltraHonk verifier — no trusted setup required.',
  },
  {
    num: '02',
    title: 'Policy enforcement',
    body: 'Spending limits, daily caps, multi-signature thresholds, and role requirements are enforced at the contract level. No operator can bypass them — not even the admin.',
  },
  {
    num: '03',
    title: 'HSP audit records',
    body: 'Every payment creates a structured Cart Mandate via HashKey Settlement Protocol — machine-readable accounting documentation produced automatically at the protocol level.',
  },
]

export function SolutionSection() {
  return (
    <section className="px-10 py-16 border-b border-border bg-surface-secondary">
      <div className="section-tag">The solution</div>
      <h2 className="text-3xl font-bold text-text-primary tracking-tight leading-tight mb-3">
        Compliance enforced by<br />mathematics, not by trust.
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed max-w-lg mb-10">
        Nexash uses zero-knowledge proofs to verify that a recipient is KYC-compliant and
        a payment satisfies policy — without putting any identity data on-chain.
        The smart contract is the compliance officer.
      </p>

      <div className="grid grid-cols-3 gap-5">
        {solutions.map((s) => (
          <div key={s.num} className="bg-white border border-border rounded-xl p-6">
            <div className="text-xs font-bold text-brand-600 mb-3">{s.num}</div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">{s.title}</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
