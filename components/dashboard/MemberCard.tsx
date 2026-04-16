'use client'

import { useQuery } from '@tanstack/react-query'
import { publicClient } from '@/lib/contracts/client'
import { ZK_TREASURY_ABI } from '@/lib/contracts/abis'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { RoleBadge, type Role } from '@/components/ui/RoleBadge'
import type { TreasuryState } from '@/hooks/useTreasury'

interface MemberCardProps {
  treasury:        TreasuryState
  treasuryAddress: string
}

export function MemberCard({ treasury, treasuryAddress }: MemberCardProps) {
  const { data: memberRoles } = useQuery({
    queryKey: ['member-roles', treasuryAddress, treasury.members],
    queryFn: async () => {
      const roles = await Promise.all(
        treasury.members.map((addr) =>
          publicClient.readContract({
            address:      treasuryAddress as `0x${string}`,
            abi:          ZK_TREASURY_ABI,
            functionName: 'roles',
            args:         [addr as `0x${string}`],
          })
        )
      )
      return treasury.members.map((addr, i) => ({
        address: addr,
        role:    Number(roles[i]) as Role,
      }))
    },
    enabled: treasury.members.length > 0,
  })

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
        <h2 className="text-[13px] font-semibold text-black">Members</h2>
        <span className="text-[11px] text-neutral-400">{treasury.memberCount.toString()} total</span>
      </div>

      {!memberRoles || memberRoles.length === 0 ? (
        <div className="px-5 py-6 text-center text-[12px] text-neutral-400">No members</div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {memberRoles.map((m) => (
            <div key={m.address} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center">
                  <span className="text-[10px] text-neutral-500 font-medium">
                    {m.address.slice(2, 4).toUpperCase()}
                  </span>
                </div>
                <AddressDisplay address={m.address} truncate showCopy showExplorer />
              </div>
              <RoleBadge role={m.role} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
