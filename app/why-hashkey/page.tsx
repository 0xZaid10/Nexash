import { Navbar } from '@/components/landing/Navbar'
import { Footer } from '@/components/landing/Footer'

const contracts = [
  { label: 'ZKTreasury',        addr: '0x3d1e6d13b3a9e90c10f2b19a19f58159c8564e88', desc: 'Core treasury with ZK-gated payment enforcement' },
  { label: 'TreasuryFactory',   addr: '0x1ec4fdfd91580de3d6b4c724af65fb04b535f9c2', desc: 'Deploys isolated treasury instances per organization' },
  { label: 'IdentityVerifier',  addr: '0x918b35b34b01Ba57Fdce0C1ac968Cf1A1d00e49C', desc: 'On-chain UltraHonk identity proof verifier (N=65536)' },
  { label: 'PolicyVerifier',    addr: '0x789f691009E9F7d97759Ff51d38614416448523c', desc: 'On-chain UltraHonk policy proof verifier (N=32768)' },
  { label: 'PolicyEngine',      addr: '0x38ad881ab5741ce2a4cff97582befe5ae7734d37', desc: 'Stores pedersen policy hash per treasury' },
  { label: 'HSPAdapter',        addr: '0x2209f1a4c94e6ab2dadd9aa69710ca520a63fda4', desc: '7-state HSP payment lifecycle state machine' },
  { label: 'KYCGate',           addr: '0x2417c6802d422dce499207e50cf7374f187585ce', desc: 'Secondary KYC check via HashKey SBT interface' },
  { label: 'MockKycSBT',        addr: '0xdfd630f56e0a61e51f7e68e3d7b91c82e0b4e13f', desc: 'Testnet KYC SBT (identical interface to production)' },
]

const reasons = [
  {
    title: 'Native on-chain KYC infrastructure',
    body: 'HashKey Chain deploys KYC Soul Bound Tokens for every verified user. Nexash uses this as a second, independent compliance layer running alongside ZK proofs. When a payment is initiated, KYCGate queries the SBT directly — if the recipient\'s KYC is revoked or below the required level, the payment reverts regardless of proof validity.',
    highlight: 'No other EVM chain offers native on-chain KYC at the infrastructure level.',
  },
  {
    title: 'HashKey Settlement Protocol',
    body: 'HSP is a structured payment protocol built into HashKey Chain that produces machine-readable Cart Mandates for every payment. These mandates include HMAC-SHA256 authentication, ES256K JWT merchant authorization, and a 7-state payment lifecycle. Every Nexash payment creates an HSP mandate automatically — no manual reconciliation, no custom audit infrastructure needed.',
    highlight: 'Auditors receive structured, cryptographically signed payment records at the protocol level.',
  },
  {
    title: 'Institutional focus and regulatory alignment',
    body: 'HashKey Group is one of Asia\'s largest regulated crypto exchanges with 600K+ KYC-verified users. HashKey Chain has HKMA engagement, licensed fiat rails, and $220M+ in RWA tokenization partnerships. This is the only L2 built explicitly for regulated institutional use — not retail DeFi that institutions are forced to adapt.',
    highlight: 'The regulatory environment matches the product. That is not true of any other chain.',
  },
  {
    title: 'Why UltraHonk over Groth16',
    body: 'Every competitor in this hackathon using ZK chose Groth16 with Circom — and most admitted their verifiers are simulated. Groth16 requires a trusted setup ceremony: someone must generate toxic waste and you must trust they deleted it. UltraHonk (which Nexash uses) is a transparent proof system requiring no ceremony. The trustlessness is mathematical, not assumed.',
    highlight: 'For institutional compliance infrastructure, "trust us we deleted it" is not acceptable.',
  },
]

export default function WhyHashKeyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-16">

        {/* Header */}
        <div className="border-b border-neutral-100 bg-neutral-50 py-16 px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-4">
              Why HashKey Chain
            </div>
            <h1 className="text-[44px] font-bold text-black tracking-[-1.5px] leading-[1.1] mb-4">
              The only chain built<br />for regulated institutions.
            </h1>
            <p className="text-[15px] text-neutral-500 leading-relaxed max-w-xl">
              Nexash is not just deployed on HashKey Chain — it is designed around
              HashKey Chain's unique institutional infrastructure.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-12 py-16 space-y-5">

          {/* Reasons */}
          {reasons.map((r, i) => (
            <div key={i} className="border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="p-7">
                <h2 className="text-[18px] font-bold text-black tracking-tight mb-3">{r.title}</h2>
                <p className="text-[14px] text-neutral-500 leading-relaxed mb-4">{r.body}</p>
                <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <span className="text-indigo-500 mt-0.5">→</span>
                  <p className="text-[13px] text-indigo-700 font-medium">{r.highlight}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Contracts table */}
          <div className="border border-neutral-200 rounded-2xl overflow-hidden mt-8">
            <div className="px-7 py-5 border-b border-neutral-100 bg-neutral-50">
              <h2 className="text-[16px] font-bold text-black">Deployed contracts</h2>
              <p className="text-[13px] text-neutral-500 mt-1">HashKey Chain Testnet · Chain ID 133 · All E2E verified</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {contracts.map((c) => (
                <div key={c.label} className="flex items-center gap-5 px-7 py-4 hover:bg-neutral-50 transition-colors">
                  <div className="w-36 shrink-0">
                    <span className="text-[13px] font-semibold text-black">{c.label}</span>
                  </div>
                  <a
                    href={`https://testnet-explorer.hsk.xyz/address/${c.addr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-indigo-600 hover:underline w-44 shrink-0"
                  >
                    {c.addr.slice(0, 10)}...{c.addr.slice(-8)}
                  </a>
                  <span className="text-[12px] text-neutral-400">{c.desc}</span>
                </div>
              ))}
            </div>
            <div className="px-7 py-4 bg-green-50 border-t border-green-100 flex items-center justify-between">
              <span className="text-[12px] text-green-700 font-medium">
                E2E verified · tx 0xe4ce...9964 · Block 26315733 · Gas 5,387,006
              </span>
              <a
                href="https://testnet-explorer.hsk.xyz/tx/0xe4ce2f122dee2aeb6e80a2b7b52c6157bfecf0e6a72303fb97ba4ae3a7519964"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-green-700 hover:underline font-medium"
              >
                View transaction ↗
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
