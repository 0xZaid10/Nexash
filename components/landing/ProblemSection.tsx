const problems = [
  {
    num: '01',
    title: 'Identity on-chain destroys privacy',
    body: 'Regulators require knowing who you are paying. But putting KYC data on a public blockchain creates permanent liability and violates the privacy that makes self-custody valuable.',
    color: 'bg-red-50 border-red-100',
    numColor: 'text-red-400',
  },
  {
    num: '02',
    title: 'No spending controls exist',
    body: 'Multi-sig wallets have no concept of per-transaction limits, daily caps, KYC requirements, or jurisdiction rules. Any operator can move any amount to anyone.',
    color: 'bg-orange-50 border-orange-100',
    numColor: 'text-orange-400',
  },
  {
    num: '03',
    title: 'No structured audit trail',
    body: 'A transaction hash is not accounting documentation. Auditors cannot accept raw blockchain data as evidence of compliant payment flows without significant additional infrastructure.',
    color: 'bg-amber-50 border-amber-100',
    numColor: 'text-amber-500',
  },
  {
    num: '04',
    title: 'Custodians are still middlemen',
    body: 'Delegating treasury management to a custodian means trusting a third party with your funds entirely — eliminating the self-custody advantage that makes blockchain valuable.',
    color: 'bg-neutral-50 border-neutral-200',
    numColor: 'text-neutral-400',
  },
]

export function ProblemSection() {
  return (
    <section className="bg-white border-t border-neutral-100 py-28 px-12">
      <div className="max-w-6xl mx-auto">

        <div className="grid grid-cols-2 gap-16 mb-16 items-end">
          <div>
            <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-4">
              The problem
            </div>
            <h2 className="text-[38px] font-bold text-black tracking-[-1.2px] leading-[1.1]">
              Blockchain treasury<br />
              is broken for<br />
              regulated institutions.
            </h2>
          </div>
          <p className="text-[15px] text-neutral-500 leading-relaxed pb-2">
            Every organization that tried to adopt on-chain treasury management hit the same wall.
            The technology is ready. The compliance infrastructure is not.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {problems.map((p) => (
            <div
              key={p.num}
              className={`border ${p.color} rounded-2xl p-7 hover:shadow-sm transition-shadow`}
            >
              <div className={`text-[11px] font-bold ${p.numColor} mb-4 tracking-widest`}>
                {p.num}
              </div>
              <h3 className="text-[16px] font-semibold text-black mb-3 leading-tight">{p.title}</h3>
              <p className="text-[13px] text-neutral-500 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
