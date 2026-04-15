'use client'

import { useQuery } from '@tanstack/react-query'
import { usePrivy } from '@privy-io/react-auth'
import { publicClient } from '@/lib/contracts/client'
import { CONTRACTS, TOKENS } from '@/lib/contracts/addresses'
import { ZK_TREASURY_ABI, POLICY_ENGINE_ABI, ERC20_ABI } from '@/lib/contracts/abis'

export type Role = 0 | 1 | 2 | 3

export interface TreasuryState {
  name: string
  initialized: boolean
  paused: boolean
  balance: bigint
  members: string[]
  memberCount: bigint
  allowedTokens: string[]
  policy: {
    spendingLimit: bigint
    dailySpendLimit: bigint
    multisigThreshold: number
    minKycLevel: number
    minRole: number
    active: boolean
    allowedJurisdictionsRoot: string
    policyHash: string
  } | null
  currentUserRole: Role
  isAdmin: boolean
  isOperator: boolean
}

const TREASURY = CONTRACTS.ZK_TREASURY
const POLICY   = CONTRACTS.POLICY_ENGINE

export function useTreasury() {
  const { user } = usePrivy()
  const walletAddress = user?.wallet?.address as `0x${string}` | undefined

  return useQuery({
    queryKey: ['treasury', TREASURY, walletAddress],
    queryFn: async (): Promise<TreasuryState> => {
      const [
        name,
        initialized,
        paused,
        balance,
        members,
        memberCount,
        allowedTokens,
        policy,
        userRole,
      ] = await Promise.all([
        publicClient.readContract({ address: TREASURY, abi: ZK_TREASURY_ABI, functionName: 'name' }),
        publicClient.readContract({ address: TREASURY, abi: ZK_TREASURY_ABI, functionName: 'initialized' }),
        publicClient.readContract({ address: TREASURY, abi: ZK_TREASURY_ABI, functionName: 'paused' }),
        publicClient.readContract({ address: TREASURY, abi: ZK_TREASURY_ABI, functionName: 'getBalance', args: [TOKENS.USDC_E] }),
        publicClient.readContract({ address: TREASURY, abi: ZK_TREASURY_ABI, functionName: 'getMembers' }),
        publicClient.readContract({ address: TREASURY, abi: ZK_TREASURY_ABI, functionName: 'getMemberCount' }),
        publicClient.readContract({ address: TREASURY, abi: ZK_TREASURY_ABI, functionName: 'getAllowedTokens' }),
        publicClient.readContract({ address: POLICY, abi: POLICY_ENGINE_ABI, functionName: 'getPolicy', args: [TREASURY] }),
        walletAddress
          ? publicClient.readContract({ address: TREASURY, abi: ZK_TREASURY_ABI, functionName: 'roles', args: [walletAddress] })
          : Promise.resolve(0),
      ])

      const role = Number(userRole) as Role

      return {
        name: name as string,
        initialized: initialized as boolean,
        paused: paused as boolean,
        balance: balance as bigint,
        members: members as string[],
        memberCount: memberCount as bigint,
        allowedTokens: allowedTokens as string[],
        policy: policy as TreasuryState['policy'],
        currentUserRole: role,
        isAdmin: role === 3,
        isOperator: role >= 2,
      }
    },
    enabled: true,
    refetchInterval: 15_000,
  })
}

export function usePaymentHistory(treasuryAddress?: string) {
  const addr = (treasuryAddress ?? TREASURY) as `0x${string}`
  return useQuery({
    queryKey: ['payment-history', addr],
    queryFn: async () => {
      const logs = await publicClient.getLogs({
        address: addr,
        event: {
          type: 'event',
          name: 'PaymentExecuted',
          inputs: [
            { name: 'paymentRequestId', type: 'bytes32', indexed: true },
            { name: 'recipient',        type: 'address', indexed: true },
            { name: 'amount',           type: 'uint256' },
          ],
        },
        fromBlock: 0n,
      })
      return logs.map((log) => ({
        txHash:           log.transactionHash,
        blockNumber:      log.blockNumber,
        paymentRequestId: log.args.paymentRequestId as string,
        recipient:        log.args.recipient as string,
        amount:           log.args.amount as bigint,
      })).reverse()
    },
    refetchInterval: 15_000,
  })
}
