export const ZK_TREASURY_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'initialized', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'roles', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint8' }] },
  { name: 'members', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'getMemberCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getMembers', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { name: 'getBalance', type: 'function', stateMutability: 'view', inputs: [{ name: 'token', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getAllowedTokens', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { name: 'allowedTokens', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'isNullifierUsed', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'bool' }] },
  { name: 'usedPaymentRequests', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'bool' }] },
  { name: 'getPendingPayment', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ components: [{ name: 'paymentRequestId', type: 'bytes32' }, { name: 'token', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'approvals', type: 'uint256' }, { name: 'executed', type: 'bool' }, { name: 'createdAt', type: 'uint256' }], type: 'tuple' }] },
  { name: 'ADMIN_ROLE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { name: 'OPERATOR_ROLE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { name: 'VIEWER_ROLE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { name: 'hasRole', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'PROOF_EXPIRY', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    name: 'initiatePayment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'paymentReqId', type: 'bytes32' },
      { name: 'identityProof', type: 'bytes' },
      { name: 'identityPubInputs', type: 'bytes32[]' },
      { name: 'policyProof', type: 'bytes' },
      { name: 'policyPubInputs', type: 'bytes32[]' },
    ],
    outputs: [],
  },
  { name: 'approvePayment', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
  { name: 'rejectPayment', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
  { name: 'grantRole', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'role', type: 'uint8' }], outputs: [] },
  { name: 'revokeRole', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }], outputs: [] },
  { name: 'allowToken', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  { name: 'removeToken', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }], outputs: [] },
  { name: 'pause', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'unpause', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'updatePolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_spendingLimit', type: 'uint256' }, { name: '_dailySpendLimit', type: 'uint256' }, { name: '_multisigThreshold', type: 'uint8' }, { name: '_minKycLevel', type: 'uint8' }, { name: '_minRole', type: 'uint8' }, { name: '_allowedJurisdictionsRoot', type: 'bytes32' }, { name: '_policyHash', type: 'bytes32' }], outputs: [] },
  { name: 'PaymentExecuted', type: 'event', inputs: [{ name: 'paymentRequestId', type: 'bytes32', indexed: true }, { name: 'recipient', type: 'address', indexed: true }, { name: 'amount', type: 'uint256' }] },
  { name: 'PaymentInitiated', type: 'event', inputs: [{ name: 'paymentRequestId', type: 'bytes32', indexed: true }, { name: 'recipient', type: 'address', indexed: true }, { name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }] },
  { name: 'NullifierUsed', type: 'event', inputs: [{ name: 'nullifier', type: 'bytes32', indexed: true }] },
] as const

export const POLICY_ENGINE_ABI = [
  { name: 'getPolicy', type: 'function', stateMutability: 'view', inputs: [{ name: 'treasury', type: 'address' }], outputs: [{ components: [{ name: 'spendingLimit', type: 'uint256' }, { name: 'dailySpendLimit', type: 'uint256' }, { name: 'multisigThreshold', type: 'uint8' }, { name: 'minKycLevel', type: 'uint8' }, { name: 'minRole', type: 'uint8' }, { name: 'active', type: 'bool' }, { name: 'allowedJurisdictionsRoot', type: 'bytes32' }, { name: 'policyHash', type: 'bytes32' }], type: 'tuple' }] },
  { name: 'getPolicyHash', type: 'function', stateMutability: 'view', inputs: [{ name: 'treasury', type: 'address' }], outputs: [{ type: 'bytes32' }] },
  { name: 'getDailySpend', type: 'function', stateMutability: 'view', inputs: [{ name: 'treasury', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'isRegistered', type: 'function', stateMutability: 'view', inputs: [{ name: 'treasury', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

export const HSP_ADAPTER_ABI = [
  { name: 'getMandate', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ components: [{ name: 'cartMandateId', type: 'bytes32' }, { name: 'paymentRequestId', type: 'bytes32' }, { name: 'treasury', type: 'address' }, { name: 'token', type: 'address' }, { name: 'payTo', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'cartExpiry', type: 'uint256' }, { name: 'merchantName', type: 'string' }, { name: 'state', type: 'uint8' }, { name: 'createdAt', type: 'uint256' }, { name: 'updatedAt', type: 'uint256' }, { name: 'txHash', type: 'bytes32' }, { name: 'statusReason', type: 'string' }], type: 'tuple' }] },
  { name: 'getState', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint8' }] },
  { name: 'getTreasuryPayments', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bytes32[]' }] },
  { name: 'isTerminal', type: 'function', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'bool' }] },
] as const

export const TREASURY_FACTORY_ABI = [
  { name: 'deployTreasury', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'name', type: 'string' }, { name: 'admin', type: 'address' }, { name: 'spendingLimit', type: 'uint256' }, { name: 'dailySpendLimit', type: 'uint256' }, { name: 'multisigThreshold', type: 'uint8' }, { name: 'minKycLevel', type: 'uint8' }, { name: 'minRole', type: 'uint8' }, { name: 'jurisdictionsRoot', type: 'bytes32' }, { name: 'policyHash', type: 'bytes32' }, { name: 'allowedTokens', type: 'address[]' }], outputs: [{ name: 'treasury', type: 'address' }] },
  { name: 'getTreasuriesOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'address[]' }] },
  { name: 'totalTreasuries', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'isTreasury', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
] as const

export const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const
