const steps = [
  { n: '1', title: 'Deploy treasury',        desc: 'One transaction via TreasuryFactory. Full isolation per organization.' },
  { n: '2', title: 'Set compliance policy',  desc: 'Spending limits, KYC level, allowed jurisdictions stored on-chain.' },
  { n: '3', title: 'Generate ZK proofs',     desc: 'Identity and policy proofs generated in the browser. Data never leaves the device.' },
  { n: '4', title: 'On-chain verification',  desc: 'Smart contract verifies both proofs. KYC gate checked independently.' },
  { n: '5', title: 'Payment executes',       desc: 'Funds transfer. HSP mandate created. Permanent audit record on-chain.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-10 py-16 border-b border-border">
      <div className="section-tag">How it works</div>
      <h2 className="text-3xl font-bold text-text-primary tracking-tight leading-tight mb-2">
        Five steps. No middleman.<br />No personal data.
      </h2>
      <p className="text-sm text-text-secondary mb-10 max-w-md">
        From treasury deployment to confirmed payment in one seamless flow.
      </p>

      <div className="flex items-start gap-0 relative">
        {/* connecting line */}
        <div className="absolute top-4 left-4 right-4 h-px bg-border z-0" />

        {steps.map((s, i) => (
          <div key={i} className="flex-1 relative z-10 pr-4 last:pr-0">
            <div className="w-8 h-8 rounded-full bg-text-primary text-white text-xs font-bold flex items-center justify-center mb-3">
              {s.n}
            </div>
            <h3 className="text-xs font-semibold text-text-primary mb-1.5">{s.title}</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
