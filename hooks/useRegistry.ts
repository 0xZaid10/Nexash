'use client'

import { useQuery } from '@tanstack/react-query'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { createWalletClient, custom } from 'viem'
import { publicClient, hashkeyTestnet } from '@/lib/contracts/client'
import { REGISTRY_ADDRESSES, USER_REGISTRY_ABI, ORG_REGISTRY_ABI } from '@/lib/contracts/registries'

export type UserType = 'individual' | 'institution' | 'none'

export interface UserProfile {
  username:     string
  wallet:       string
  verified:     boolean
  kycLevel:     number
  nullifier:    string
  registeredAt: bigint
  verifiedAt:   bigint
}

export interface OrgProfile {
  name:          string
  displayName:   string
  description:   string
  admin:         string
  registeredAt:  bigint
  treasuryCount: bigint
  active:        boolean
}

const USER_REG = REGISTRY_ADDRESSES.USER_REGISTRY
const ORG_REG  = REGISTRY_ADDRESSES.ORG_REGISTRY

// Determine what type of user the connected wallet is
export function useUserType() {
  const { user } = usePrivy()
  const wallet   = user?.wallet?.address as `0x${string}` | undefined

  return useQuery({
    queryKey: ['user-type', wallet],
    queryFn:  async (): Promise<UserType> => {
      if (!wallet) return 'none'

      const [isUser, isOrg] = await Promise.all([
        publicClient.readContract({
          address:      USER_REG,
          abi:          USER_REGISTRY_ABI,
          functionName: 'isRegistered',
          args:         [wallet],
        }),
        publicClient.readContract({
          address:      ORG_REG,
          abi:          ORG_REGISTRY_ABI,
          functionName: 'isRegistered',
          args:         [wallet],
        }),
      ])

      if (isUser) return 'individual'
      if (isOrg)  return 'institution'
      return 'none'
    },
    enabled: !!wallet,
  })
}

// Get individual user profile
export function useUserProfile() {
  const { user } = usePrivy()
  const wallet   = user?.wallet?.address as `0x${string}` | undefined

  return useQuery({
    queryKey: ['user-profile', wallet],
    queryFn:  async (): Promise<UserProfile | null> => {
      if (!wallet) return null
      const profile = await publicClient.readContract({
        address:      USER_REG,
        abi:          USER_REGISTRY_ABI,
        functionName: 'getProfile',
        args:         [wallet],
      })
      if (!profile.username) return null
      return profile as unknown as UserProfile
    },
    enabled: !!wallet,
  })
}

// Get organisation profile
export function useOrgProfile() {
  const { user } = usePrivy()
  const wallet   = user?.wallet?.address as `0x${string}` | undefined

  return useQuery({
    queryKey: ['org-profile', wallet],
    queryFn:  async (): Promise<OrgProfile | null> => {
      if (!wallet) return null
      const profile = await publicClient.readContract({
        address:      ORG_REG,
        abi:          ORG_REGISTRY_ABI,
        functionName: 'getProfile',
        args:         [wallet],
      })
      if (!profile.active) return null
      return profile as unknown as OrgProfile
    },
    enabled: !!wallet,
  })
}

// Get org's deployed treasuries
export function useOrgTreasuries() {
  const { user } = usePrivy()
  const wallet   = user?.wallet?.address as `0x${string}` | undefined

  return useQuery({
    queryKey: ['org-treasuries', wallet],
    queryFn:  async (): Promise<string[]> => {
      if (!wallet) return []
      const treasuries = await publicClient.readContract({
        address:      ORG_REG,
        abi:          ORG_REGISTRY_ABI,
        functionName: 'getOrgTreasuries',
        args:         [wallet],
      })
      return treasuries as string[]
    },
    enabled: !!wallet,
  })
}

// Resolve username to address
export async function resolveUsername(username: string): Promise<string | null> {
  try {
    const addr = await publicClient.readContract({
      address:      USER_REG,
      abi:          USER_REGISTRY_ABI,
      functionName: 'resolve',
      args:         [username.toLowerCase()],
    })
    if (addr === '0x0000000000000000000000000000000000000000') return null
    return addr as string
  } catch {
    return null
  }
}

// Resolve org name to admin address
export async function resolveOrgName(name: string): Promise<string | null> {
  try {
    const addr = await publicClient.readContract({
      address:      ORG_REG,
      abi:          ORG_REGISTRY_ABI,
      functionName: 'resolve',
      args:         [name.toLowerCase()],
    })
    if (addr === '0x0000000000000000000000000000000000000000') return null
    return addr as string
  } catch {
    return null
  }
}

// Check username availability
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  try {
    return await publicClient.readContract({
      address:      USER_REG,
      abi:          USER_REGISTRY_ABI,
      functionName: 'getUsernameAvailable',
      args:         [username],
    }) as boolean
  } catch {
    return false
  }
}

// Check org name availability
export async function checkOrgNameAvailable(name: string): Promise<boolean> {
  try {
    return await publicClient.readContract({
      address:      ORG_REG,
      abi:          ORG_REGISTRY_ABI,
      functionName: 'getOrgNameAvailable',
      args:         [name],
    }) as boolean
  } catch {
    return false
  }
}

// Write: register individual username
export async function registerUsername(
  username: string,
  wallets:  ReturnType<typeof useWallets>['wallets']
): Promise<string> {
  const wallet   = wallets[0]
  const provider = await wallet.getEthereumProvider()
  const wc = createWalletClient({
    account:   wallet.address as `0x${string}`,
    chain:     hashkeyTestnet,
    transport: custom(provider),
  })
  return wc.writeContract({
    address:      USER_REG,
    abi:          USER_REGISTRY_ABI,
    functionName: 'register',
    args:         [username],
  })
}

// Write: register org
export async function registerOrg(
  name:        string,
  displayName: string,
  description: string,
  wallets:     ReturnType<typeof useWallets>['wallets']
): Promise<string> {
  const wallet   = wallets[0]
  const provider = await wallet.getEthereumProvider()
  const wc = createWalletClient({
    account:   wallet.address as `0x${string}`,
    chain:     hashkeyTestnet,
    transport: custom(provider),
  })
  return wc.writeContract({
    address:      ORG_REG,
    abi:          ORG_REGISTRY_ABI,
    functionName: 'registerOrg',
    args:         [name, displayName, description],
  })
}

// Write: add treasury to org registry
export async function addTreasuryToOrg(
  treasury: string,
  wallets:  ReturnType<typeof useWallets>['wallets']
): Promise<string> {
  const wallet   = wallets[0]
  const provider = await wallet.getEthereumProvider()
  const wc = createWalletClient({
    account:   wallet.address as `0x${string}`,
    chain:     hashkeyTestnet,
    transport: custom(provider),
  })
  return wc.writeContract({
    address:      ORG_REG,
    abi:          ORG_REGISTRY_ABI,
    functionName: 'addTreasury',
    args:         [treasury as `0x${string}`],
  })
}

// Write: verify identity on-chain
export async function verifyIdentityOnChain(
  proof:        Uint8Array,
  publicInputs: string[],
  wallets:      ReturnType<typeof useWallets>['wallets'],
  reportTxHash: string,
  taskId:       string,
): Promise<string> {
  const wallet   = wallets[0]
  const provider = await wallet.getEthereumProvider()
  const wc = createWalletClient({
    account:   wallet.address as `0x${string}`,
    chain:     hashkeyTestnet,
    transport: custom(provider),
  })
  const proofHex        = ('0x' + Buffer.from(proof).toString('hex')) as `0x${string}`
  const reportTxHashHex = reportTxHash.startsWith('0x') ? reportTxHash as `0x${string}` : `0x${reportTxHash}` as `0x${string}`
  const taskIdHex       = taskId.startsWith('0x') ? taskId as `0x${string}` : `0x${taskId}` as `0x${string}`
  return wc.writeContract({
    address:      USER_REG,
    abi:          USER_REGISTRY_ABI,
    functionName: 'verifyIdentity',
    args:         [proofHex, publicInputs as `0x${string}`[], reportTxHashHex, taskIdHex],
  })
}
