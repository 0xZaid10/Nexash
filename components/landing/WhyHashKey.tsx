const reasons = [
  {
    title: 'Native KYC infrastructure',
    body: 'HashKey Chain has on-chain KYC Soul Bound Tokens. Nexash uses this as a second, independent compliance layer alongside ZK proofs. No other chain offers this.',
  },
  {
    title: 'HashKey Settlement Protocol',
    body: 'HSP produces structured, audit-ready payment records at the protocol level. Every Nexash payment creates an HSP mandate automatically — no manual reconciliation needed.',
  },
  {
    title: 'Institutional partnerships',
    body: 'HKMA engagement, licensed fiat rails, $220M+ in RWA tokenization. HashKey is the only L2 where institutional treasury management is a realistic near-term use case.',
  },
]

const contracts = [
  { label: 'ZKTreasury',      addr: '0x3d1e...4e88' },
  { label: 'TreasuryFactory', addr: '0x1ec4...9c2' },
  { label: 'IdentityVerifier', addr: '0x918b...49C' },
  { label: 'PolicyVerifier',  addr: '0x789f...23c' },
  { label: 'PolicyEngine',    addr: '0x38ad...d37' },
  { label: 'HSPAdapter',      addr: '0x2209...da4' },
  { label: 'KYCGate',         addr: '0x2417...5ce' },
]

export function WhyHashKey() {
  return (
    <section id="why-hashkey" className="px-10 py-16 border-b border-border">
      <div className="grid grid-cols-2 gap-16">
        {/* Left */}
        <div>
          <div className="section-tag">Why HashKey Chain</div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight leading-tight mb-8">
            The only chain built<br />for regulated institutions.
          </h2>
          <div className="flex flex-col gap-5">
            {reasons.map((r) => (
              <div key={r.title} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-1">{r.title}</h4>
                  <p className="text-xs text-text-tertiary leading-relaxed">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — deployed contracts */}
        <div>
          <div className="section-tag">Deployed contracts</div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight mb-5">
            Live on HashKey testnet
          </h2>
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-5">
            <div className="text-2xs font-semibold text-brand-600 uppercase tracking-wide mb-3">
              Contract addresses · Chain ID 133
            </div>
            <div className="flex flex-col gap-0">
              {contracts.map((c, i) => (
                <div
                  key={c.label}
                  className={`flex justify-between py-2 text-xs ${i < contracts.length - 1 ? 'border-b border-brand-100' : ''}`}
                >
                  <span className="text-text-secondary font-medium">{c.label}</span>
                  <span className="font-mono text-text-tertiary">{c.addr}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-brand-100">
              <a
                href="https://testnet-explorer.hsk.xyz/tx/0xe4ce2f122dee2aeb6e80a2b7b52c6157bfecf0e6a72303fb97ba4ae3a7519964"
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xs text-brand-600 hover:underline"
              >
                E2E verified · tx 0xe4ce...9964 · Block 26315733 ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
