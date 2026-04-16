'use client'

import { usePaymentHistory } from '@/hooks/useTreasury'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { getExplorerTxUrl } from '@/lib/contracts/client'

function formatAmount(amount: bigint): string {
  return (Number(amount) / 1e6).toFixed(2)
}

export function PaymentTable({ treasuryAddress }: { treasuryAddress?: string }) {
  const { data: payments, isLoading } = usePaymentHistory(treasuryAddress)

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold text-black">Payment history</h2>
        <span className="text-[11px] text-neutral-400">
          {payments ? `${payments.length} total` : ''}
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-5 px-5 py-2 bg-neutral-50 border-b border-neutral-100 text-[10px] text-neutral-400 font-medium">
        <div>Transaction</div>
        <div>Recipient</div>
        <div>Amount</div>
        <div>ZK proof</div>
        <div>Status</div>
      </div>

      {isLoading ? (
        <div className="px-5 py-8 text-center text-[12px] text-neutral-400">Loading payments...</div>
      ) : !payments || payments.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="text-[13px] text-neutral-400 mb-1">No payments yet</div>
          <div className="text-[11px] text-neutral-300">
            Initiate your first ZK-verified payment above
          </div>
        </div>
      ) : (
        payments.map((p) => (
          <div
            key={p.txHash}
            className="grid grid-cols-5 px-5 py-3.5 border-b border-neutral-100 last:border-0 items-center hover:bg-neutral-50 transition-colors"
          >
            <div>
              <a
                href={getExplorerTxUrl(p.txHash!)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-indigo-600 hover:underline"
              >
                {p.txHash!.slice(0, 8)}...{p.txHash!.slice(-6)}
              </a>
              <div className="text-[10px] text-neutral-400 mt-0.5">
                Block {p.blockNumber?.toString()}
              </div>
            </div>
            <div>
              <AddressDisplay address={p.recipient} truncate showCopy={false} />
            </div>
            <div className="text-[12px] font-medium text-black">
              {formatAmount(p.amount)} USDC.e
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                UltraHonk
              </span>
            </div>
            <div>
              <StatusBadge status="success" />
            </div>
          </div>
        ))
      )}
    </div>
  )
}
