// ── Addresses ─────────────────────────────────────────────────────────────

export const REGISTRY_ADDRESSES = {
  USER_REGISTRY: process.env.NEXT_PUBLIC_USER_REGISTRY as `0x${string}`,
  ORG_REGISTRY:  process.env.NEXT_PUBLIC_ORG_REGISTRY  as `0x${string}`,
} as const

// ── NexashUserRegistry ABI ─────────────────────────────────────────────────

export const USER_REGISTRY_ABI = [
  // Write
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs:  [{ name: 'username', type: 'string' }],
    outputs: [],
  },
  {
    name: 'verifyIdentity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proof',        type: 'bytes'    },
      { name: 'publicInputs', type: 'bytes32[]' },
      { name: 'reportTxHash', type: 'bytes32'  },
      { name: 'taskId',       type: 'bytes32'  },
    ],
    outputs: [],
  },
  // Read
  {
    name: 'resolve',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'username', type: 'string' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'reverseResolve',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'getProfile',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'wallet', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'username',     type: 'string'  },
        { name: 'wallet',       type: 'address' },
        { name: 'verified',     type: 'bool'    },
        { name: 'kycLevel',     type: 'uint8'   },
        { name: 'nullifier',    type: 'bytes32' },
        { name: 'registeredAt', type: 'uint256' },
        { name: 'verifiedAt',   type: 'uint256' },
      ],
    }],
  },
  {
    name: 'isVerified',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'isRegistered',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getUsernameAvailable',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'username', type: 'string' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'totalUsers',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalVerified',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint256' }],
  },
  // Events
  {
    name: 'UserRegistered',
    type: 'event',
    inputs: [
      { name: 'wallet',    type: 'address', indexed: true  },
      { name: 'username',  type: 'string',  indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'UserVerified',
    type: 'event',
    inputs: [
      { name: 'wallet',   type: 'address', indexed: true  },
      { name: 'kycLevel', type: 'uint8',   indexed: false },
      { name: 'nullifier',type: 'bytes32', indexed: false },
    ],
  },
] as const

// ── NexashOrgRegistry ABI ──────────────────────────────────────────────────

export const ORG_REGISTRY_ABI = [
  // Write
  {
    name: 'registerOrg',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name',        type: 'string' },
      { name: 'displayName', type: 'string' },
      { name: 'description', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'addTreasury',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs:  [{ name: 'treasury', type: 'address' }],
    outputs: [],
  },
  {
    name: 'updateProfile',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'displayName', type: 'string' },
      { name: 'description', type: 'string' },
    ],
    outputs: [],
  },
  // Read
  {
    name: 'resolve',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'name', type: 'string' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'reverseResolve',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'admin', type: 'address' }],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'getProfile',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'admin', type: 'address' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'name',          type: 'string'  },
        { name: 'displayName',   type: 'string'  },
        { name: 'description',   type: 'string'  },
        { name: 'admin',         type: 'address' },
        { name: 'registeredAt',  type: 'uint256' },
        { name: 'treasuryCount', type: 'uint256' },
        { name: 'active',        type: 'bool'    },
      ],
    }],
  },
  {
    name: 'getOrgTreasuries',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'admin', type: 'address' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    name: 'isRegistered',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'admin', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getOrgNameAvailable',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'name', type: 'string' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'totalOrgs',
    type: 'function',
    stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint256' }],
  },
  // Events
  {
    name: 'OrgRegistered',
    type: 'event',
    inputs: [
      { name: 'admin',       type: 'address', indexed: true  },
      { name: 'name',        type: 'string',  indexed: false },
      { name: 'displayName', type: 'string',  indexed: false },
      { name: 'timestamp',   type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'TreasuryAdded',
    type: 'event',
    inputs: [
      { name: 'admin',    type: 'address', indexed: true  },
      { name: 'treasury', type: 'address', indexed: true  },
      { name: 'total',    type: 'uint256', indexed: false },
    ],
  },
] as const
