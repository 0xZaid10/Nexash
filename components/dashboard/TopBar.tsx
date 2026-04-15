'use client'

import { usePrivy } from '@privy-io/react-auth'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { RoleBadge, type Role } from '@/components/ui/RoleBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'

interface TopBarProps {
  treasuryName: string
  paused: boolean
  currentRole: Role
}

export function TopBar({ treasuryName, paused, currentRole }: TopBarProps) {
  const { user, logout } = usePrivy()
  const wallet = user?.wallet?.address

  return (
    <header className="flex items-center justify-between px-7 py-3.5 border-b border-border bg-white sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-sm font-bold text-text-primary tracking-tight">
          Nex<span className="text-brand-600">.</span>ash
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary">{treasuryName}</span>
          {paused ? (
            <StatusBadge status="paused" />
          ) : (
            <StatusBadge status="active" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <RoleBadge role={currentRole} />
        {wallet && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary border border-border rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <AddressDisplay address={wallet} truncate showCopy className="text-text-primary text-xs" />
          </div>
        )}
        <button
          onClick={logout}
          className="text-2xs text-text-muted hover:text-text-secondary transition-colors px-2 py-1 rounded border border-transparent hover:border-border"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
