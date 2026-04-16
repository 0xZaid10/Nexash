import type { TreasuryState } from '@/hooks/useTreasury'

function fmt(amount: bigint): string {
  return (Number(amount) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function PolicyCard({ treasury }: { treasury: TreasuryState }) {
  const policy = treasury.policy
  if (!policy) return null

  const KYC_LABELS  = ['None', 'Basic', 'Intermediate', 'Advanced', 'Premium', 'Ultimate']
  const ROLE_LABELS = ['None', 'Viewer', 'Operator', 'Admin']

  const rows = [
    { label: 'Per-tx spending limit', value: `${fmt(policy.spendingLimit)} USDC.e` },
    { label: 'Daily spending limit',  value: `${fmt(policy.dailySpendLimit)} USDC.e` },
    { label: 'Multisig threshold',    value: policy.multisigThreshold === 1 ? 'Single sig' : `${policy.multisigThreshold} signatures` },
    { label: 'Min KYC level',         value: KYC_LABELS[policy.minKycLevel]  ?? `Level ${policy.minKycLevel}` },
    { label: 'Min operator role',     value: ROLE_LABELS[policy.minRole]      ?? `Role ${policy.minRole}` },
    { label: 'Jurisdiction',          value: policy.allowedJurisdictionsRoot === '0x' + '0'.repeat(64) ? 'Open (all)' : `${policy.allowedJurisdictionsRoot.slice(0, 10)}...` },
  ]

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold text-black">Compliance policy</h2>
      </div>
      <div className="divide-y divide-neutral-100">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between items-center px-5 py-2.5">
            <span className="text-[12px] text-neutral-500">{r.label}</span>
            <span className="text-[12px] font-medium text-black">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100">
        <div className="text-[11px] text-neutral-400">
          Policy hash:{' '}
          <span className="font-mono text-indigo-500">
            {policy.policyHash.slice(0, 14)}...{policy.policyHash.slice(-6)}
          </span>
        </div>
      </div>
    </div>
  )
}
