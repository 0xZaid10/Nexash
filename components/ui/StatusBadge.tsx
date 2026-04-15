'use client'

type Status = 'success' | 'pending' | 'failed' | 'active' | 'paused' | 'processing'

const STATUS_CONFIG: Record<Status, { label: string; className: string; dot: string }> = {
  success:    { label: 'Success',    className: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-500' },
  active:     { label: 'Active',     className: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-500' },
  pending:    { label: 'Pending',    className: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500' },
  processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-500' },
  failed:     { label: 'Failed',     className: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-500' },
  paused:     { label: 'Paused',     className: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
}

export function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

// HSP payment state → StatusBadge status
export function hspStateToStatus(state: number): Status {
  switch (state) {
    case 6: return 'success'
    case 7: return 'failed'
    case 4:
    case 5: return 'processing'
    case 0: return 'pending'
    default: return 'pending'
  }
}

export const HSP_STATE_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Payment required',
  2: 'Submitted',
  3: 'Verified',
  4: 'Processing',
  5: 'Included',
  6: 'Successful',
  7: 'Failed',
}
