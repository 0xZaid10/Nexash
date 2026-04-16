'use client'

import { useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { createWalletClient, custom, parseUnits } from 'viem'
import { hashkeyTestnet, publicClient, getExplorerTxUrl, getExplorerAddressUrl } from '@/lib/contracts/client'
import { CONTRACTS, TOKENS } from '@/lib/contracts/addresses'
import { TREASURY_FACTORY_ABI, ZK_TREASURY_ABI, POLICY_ENGINE_ABI } from '@/lib/contracts/abis'
import { addTreasuryToOrg } from '@/hooks/useRegistry'
import Link from 'next/link'

const KYC_LABELS  = ['None', 'Basic', 'Intermediate', 'Advanced', 'Premium']
const ROLE_LABELS = ['None', 'Viewer', 'Operator', 'Admin']

const STEPS = [
  'Simulating deployment...',
  'Deploying treasury contract...',
  'Waiting for confirmation...',
  'Computing policy hash...',
  'Updating policy on-chain...',
  'Registering with organisation...',
  'Done!',
]

export default function NewTreasuryPage() {
  const { user } = usePrivy()
  const { wallets } = useWallets()

  const [form, setForm] = useState({
    name:              '',
    spendingLimit:     '10000',
    dailySpendLimit:   '50000',
    multisigThreshold: '1',
    minKycLevel:       '2',
    minRole:           '1',   // default to 1 so it works with our test ZK setup
  })

  const [loading,  setLoading]  = useState(false)
  const [stepIdx,  setStepIdx]  = useState(-1)
  const [txHash,   setTxHash]   = useState('')
  const [deployed, setDeployed] = useState('')
  const [error,    setError]    = useState('')

  function update(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setStep(i: number) {
    setStepIdx(i)
  }

  // Compute pedersen hash using bb.js directly (no circuit needed)
  async function computePolicyHash(
    spendingLimit:     bigint,
    dailySpendLimit:   bigint,
    multisigThreshold: bigint,
    minRole:           bigint,
    treasuryAddress:   string
  ): Promise<`0x${string}`> {
    const { Barretenberg } = await import('@aztec/bb.js')
    const api = await Barretenberg.new({ threads: 1 })

    function toField(v: bigint): Uint8Array {
      const buf = new Uint8Array(32)
      let val = v
      for (let i = 31; i >= 0; i--) {
        buf[i] = Number(val & 0xffn)
        val >>= 8n
      }
      return buf
    }

    const result = await api.pedersenHash({
      inputs: [
        toField(spendingLimit),
        toField(dailySpendLimit),
        toField(multisigThreshold),
        toField(minRole),
        toField(BigInt(treasuryAddress)),
      ],
      hashIndex: 0,
    })

    await api.destroy()
    return ('0x' + Buffer.from(result.hash).toString('hex')) as `0x${string}`
  }

  // Extract deployed treasury address from receipt logs
  // TreasuryDeployed(address indexed treasury, address indexed admin, string name)
  // topics[1] = treasury (first indexed), topics[2] = admin (second indexed)
  function extractTreasuryFromReceipt(
    receipt: { logs: readonly { topics: readonly string[]; address: string }[] }
  ): string | null {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== CONTRACTS.TREASURY_FACTORY.toLowerCase()) continue
      if (log.topics.length < 3) continue
      const addr = ('0x' + log.topics[1].slice(26)).toLowerCase()
      if (addr !== '0x0000000000000000000000000000000000000000') {
        return '0x' + log.topics[1].slice(26)
      }
    }
    return null
  }

  async function handleDeploy() {
    if (!form.name || !user?.wallet?.address) return
    setLoading(true)
    setError('')
    setStepIdx(0)

    try {
      const wallet   = wallets[0]
      const provider = await wallet.getEthereumProvider()
      const wc = createWalletClient({
        account:   wallet.address as `0x${string}`,
        chain:     hashkeyTestnet,
        transport: custom(provider),
      })

      const spendingLimit     = parseUnits(form.spendingLimit,   6)
      const dailySpendLimit   = parseUnits(form.dailySpendLimit, 6)
      const multisigThreshold = Number(form.multisigThreshold)
      const minKycLevel       = Number(form.minKycLevel)
      const minRole           = Number(form.minRole)

      // Step 0 — simulate
      setStep(0)
      await publicClient.simulateContract({
        address:      CONTRACTS.TREASURY_FACTORY,
        abi:          TREASURY_FACTORY_ABI,
        functionName: 'deployTreasury',
        args: [
          form.name,
          wallet.address as `0x${string}`,
          spendingLimit,
          dailySpendLimit,
          multisigThreshold,
          minKycLevel,
          minRole,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          [TOKENS.USDC_E],
        ],
        account: wallet.address as `0x${string}`,
      })

      // Step 1 — deploy with zero policy hash (will update after)
      setStep(1)
      const hash = await wc.writeContract({
        address:      CONTRACTS.TREASURY_FACTORY,
        abi:          TREASURY_FACTORY_ABI,
        functionName: 'deployTreasury',
        args: [
          form.name,
          wallet.address as `0x${string}`,
          spendingLimit,
          dailySpendLimit,
          multisigThreshold,
          minKycLevel,
          minRole,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          [TOKENS.USDC_E],
        ],
      })
      setTxHash(hash)

      // Step 2 — wait for receipt
      setStep(2)
      const receipt = await publicClient.waitForTransactionReceipt({
        hash:    hash as `0x${string}`,
        timeout: 60_000,
      })

      if (receipt.status === 'reverted') throw new Error('Transaction reverted on-chain')

      // Extract treasury address
      let treasuryAddr = extractTreasuryFromReceipt(receipt)
      if (!treasuryAddr) {
        // Fallback: query factory
        const list = await publicClient.readContract({
          address:      CONTRACTS.TREASURY_FACTORY,
          abi:          TREASURY_FACTORY_ABI,
          functionName: 'getTreasuriesOf',
          args:         [wallet.address as `0x${string}`],
        }) as string[]
        treasuryAddr = list[list.length - 1] ?? null
      }
      if (!treasuryAddr) throw new Error('Could not determine deployed treasury address')

      // Verify it has code
      const code = await publicClient.getCode({ address: treasuryAddr as `0x${string}` })
      if (!code || code === '0x') throw new Error(`Contract at ${treasuryAddr} has no code`)

      // Step 3 — compute correct policy hash for this specific treasury
      setStep(3)
      const policyHash = await computePolicyHash(
        spendingLimit,
        dailySpendLimit,
        BigInt(multisigThreshold),
        BigInt(minRole),
        treasuryAddr,
      )

      // Step 4 — update policy on-chain with correct hash
      setStep(4)
      await wc.writeContract({
        address:      treasuryAddr as `0x${string}`,
        abi:          ZK_TREASURY_ABI,
        functionName: 'updatePolicy',
        args: [
          spendingLimit,
          dailySpendLimit,
          multisigThreshold,
          minKycLevel,
          minRole,
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          policyHash,
        ],
      })

      // Step 5 — register with org registry
      setStep(5)
      await addTreasuryToOrg(treasuryAddr, wallets)

      setDeployed(treasuryAddr)
      setStep(6)

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Deployment failed'
      setError(msg)
      setStepIdx(-1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-14 bg-white/90 backdrop-blur-md border-b border-neutral-100">
        <Link href="/" className="text-[14px] font-bold tracking-tight text-black">
          Nexash<span className="text-indigo-600">.</span>
        </Link>
        <Link href="/institution" className="text-[13px] text-neutral-500 hover:text-black transition-colors flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to dashboard
        </Link>
      </header>

      <div className="pt-14 max-w-lg mx-auto px-6 py-10">
        <h1 className="text-[24px] font-bold text-black tracking-tight mb-1">Deploy new treasury</h1>
        <p className="text-[13px] text-neutral-500 mb-8">
          Each treasury is a fully isolated smart contract. The policy hash is computed and stored on-chain automatically after deployment.
        </p>

        {!deployed ? (
          <div className="space-y-5">

            {/* Treasury details */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-[14px] font-semibold text-black">Treasury details</h2>
              <div>
                <label className="label">Treasury name</label>
                <input
                  className="input"
                  placeholder="e.g. Operations Treasury"
                  value={form.name}
                  onChange={e => update('name', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Spending policy */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-[14px] font-semibold text-black">Spending policy</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Per-tx limit (USDC.e)</label>
                  <input className="input" type="number" value={form.spendingLimit}
                    onChange={e => update('spendingLimit', e.target.value)} disabled={loading}/>
                </div>
                <div>
                  <label className="label">Daily limit (USDC.e)</label>
                  <input className="input" type="number" value={form.dailySpendLimit}
                    onChange={e => update('dailySpendLimit', e.target.value)} disabled={loading}/>
                </div>
              </div>
              <div>
                <label className="label">Multisig threshold</label>
                <select className="input" value={form.multisigThreshold}
                  onChange={e => update('multisigThreshold', e.target.value)} disabled={loading}>
                  <option value="1">1 — Single operator</option>
                  <option value="2">2 — Requires 2 approvals</option>
                  <option value="3">3 — Requires 3 approvals</option>
                </select>
              </div>
            </div>

            {/* Compliance */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-[14px] font-semibold text-black">Compliance requirements</h2>
              <div>
                <label className="label">Minimum KYC level for recipients</label>
                <select className="input" value={form.minKycLevel}
                  onChange={e => update('minKycLevel', e.target.value)} disabled={loading}>
                  {KYC_LABELS.map((l, i) => i > 0 && (
                    <option key={i} value={i.toString()}>{i} — {l}</option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Recipients prove this KYC level via ZK proof — no personal data on-chain
                </p>
              </div>
              <div>
                <label className="label">Minimum operator role</label>
                <select className="input" value={form.minRole}
                  onChange={e => update('minRole', e.target.value)} disabled={loading}>
                  {ROLE_LABELS.map((l, i) => i > 0 && (
                    <option key={i} value={i.toString()}>{i} — {l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Jurisdiction policy</label>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[12px] text-neutral-600">Open — all jurisdictions permitted</span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Restrict specific jurisdictions after deployment via the admin panel
                </p>
              </div>
            </div>

            {/* What happens */}
            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                What happens on deploy
              </div>
              <div className="space-y-2">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[11px]">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold
                      ${stepIdx > i ? 'bg-green-500 text-white' :
                        stepIdx === i ? 'bg-indigo-500 text-white' :
                        'bg-neutral-200 text-neutral-500'}`}>
                      {stepIdx > i ? '✓' : i + 1}
                    </div>
                    <span className={stepIdx === i ? 'text-indigo-600 font-medium' : 'text-neutral-500'}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-[12px] text-red-600 font-medium mb-0.5">Deployment failed</p>
                <p className="text-[11px] text-red-500">{error}</p>
              </div>
            )}

            <button
              onClick={handleDeploy}
              disabled={!form.name || loading}
              className="btn-primary w-full text-[14px] py-3"
            >
              {loading ? `${STEPS[stepIdx] ?? 'Processing...'}` : 'Deploy treasury'}
            </button>
          </div>

        ) : (
          /* Success */
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M5 14l6 6L23 7" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-[20px] font-bold text-black mb-1">Treasury deployed</h2>
            <p className="text-[13px] text-neutral-500 mb-6">
              <strong>{form.name}</strong> is live with correct policy hash on-chain
            </p>
            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 mb-6 text-left space-y-2.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-neutral-400">Treasury address</span>
                <a href={getExplorerAddressUrl(deployed)} target="_blank" rel="noopener noreferrer"
                   className="font-mono text-indigo-600 hover:underline">
                  {deployed.slice(0,10)}...{deployed.slice(-6)} ↗
                </a>
              </div>
              {txHash && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-neutral-400">Deploy transaction</span>
                  <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer"
                     className="font-mono text-indigo-600 hover:underline">
                    {txHash.slice(0,10)}...{txHash.slice(-6)} ↗
                  </a>
                </div>
              )}
              <div className="flex justify-between text-[12px]">
                <span className="text-neutral-400">Policy hash</span>
                <span className="text-neutral-500 text-[11px]">Computed & stored on-chain ✓</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-neutral-400">Proof system</span>
                <span className="text-neutral-600">UltraHonk · No trusted setup</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/institution"
                className="flex-1 text-center py-2.5 text-[13px] border border-neutral-200 rounded-xl text-neutral-600 hover:border-neutral-400 transition-colors">
                Dashboard
              </Link>
              <Link href={`/institution/treasury?address=${deployed}`}
                className="flex-1 text-center py-2.5 text-[13px] bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors font-medium">
                Manage treasury
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
