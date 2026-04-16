export function StatsBar() {
  const stats = [
    { value: '54',  label: 'Tests passing',        sub: 'Zero failures · 3 suites' },
    { value: '8',   label: 'Contracts deployed',    sub: 'ZKTreasury · Factory · HSP · KYC' },
    { value: '2',   label: 'On-chain E2E proofs',   sub: 'Real ZK proofs · Real token transfers' },
    { value: '0',   label: 'Trusted third parties', sub: 'Self-custody · Math-enforced compliance' },
  ]

  return (
    <section className="grid grid-cols-4 border-t border-b border-border">
      {stats.map((s, i) => (
        <div
          key={i}
          className={`px-10 py-7 ${i < stats.length - 1 ? 'border-r border-border' : ''}`}
        >
          <div className="text-2xl font-bold text-text-primary tracking-tight">{s.value}</div>
          <div className="text-xs font-medium text-text-secondary mt-1">{s.label}</div>
          <div className="text-2xs text-text-muted mt-0.5">{s.sub}</div>
        </div>
      ))}
    </section>
  )
}
