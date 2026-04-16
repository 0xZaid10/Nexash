'use client'

// Role enum matches ZKTreasury.sol: 0=NONE, 1=VIEWER, 2=OPERATOR, 3=ADMIN
export type Role = 0 | 1 | 2 | 3

const ROLE_CONFIG: Record<Role, { label: string; className: string }> = {
  0: { label: 'No access', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  1: { label: 'Viewer',    className: 'bg-gray-100 text-gray-600 border-gray-200' },
  2: { label: 'Operator',  className: 'bg-blue-50 text-blue-700 border-blue-200' },
  3: { label: 'Admin',     className: 'bg-brand-50 text-brand-600 border-brand-200' },
}

export function RoleBadge({ role }: { role: Role }) {
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG[0]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  )
}
