'use client'

import { useState, useEffect } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { useUserType } from '@/hooks/useRegistry'
import { registerUsername, registerOrg, checkUsernameAvailable, checkOrgNameAvailable } from '@/hooks/useRegistry'
import { ConnectButton } from '@/components/ui/ConnectButton'

type Step = 'choose' | 'individual-register' | 'institution-register' | 'done'

export default function OnboardingPage() {
  const { ready, authenticated } = usePrivy()
  const { wallets }              = useWallets()
  const router                   = useRouter()
  const { data: userType, refetch } = useUserType()

  const [step,        setStep]        = useState<Step>('choose')
  const [username,    setUsername]    = useState('')
  const [orgName,     setOrgName]     = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [available,   setAvailable]   = useState<boolean | null>(null)
  const [checking,    setChecking]    = useState(false)

  // Redirect if already registered
  useEffect(() => {
    if (userType === 'individual')  router.replace('/individual')
    if (userType === 'institution') router.replace('/institution')
  }, [userType, router])

  // Check username/orgname availability with debounce
  useEffect(() => {
    const value = step === 'individual-register' ? username : orgName
    if (value.length < 3) { setAvailable(null); return }

    setChecking(true)
    const timer = setTimeout(async () => {
      const avail = step === 'individual-register'
        ? await checkUsernameAvailable(value)
        : await checkOrgNameAvailable(value)
      setAvailable(avail)
      setChecking(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [username, orgName, step])

  async function handleRegisterIndividual() {
    if (!username || !available) return
    setLoading(true)
    setError('')
    try {
      await registerUsername(username, wallets)
      await refetch()
      router.replace('/individual')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegisterOrg() {
    if (!orgName || !displayName || !available) return
    setLoading(true)
    setError('')
    try {
      await registerOrg(orgName, displayName, description, wallets)
      await refetch()
      router.replace('/institution')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="text-[22px] font-bold tracking-[-0.5px] text-black mb-1">
          Nexash<span className="text-indigo-600">.</span>
        </div>
        <div className="text-[13px] text-neutral-500">Institutional treasury on HashKey Chain</div>
      </div>

      {!authenticated ? (
        /* Not connected */
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 w-full max-w-sm text-center shadow-sm">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="7" width="16" height="11" rx="2" stroke="#4f46e5" strokeWidth="1.2"/>
              <path d="M6 7V5a4 4 0 018 0v2" stroke="#4f46e5" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-[17px] font-semibold text-black mb-2">Connect to get started</h1>
          <p className="text-[13px] text-neutral-500 mb-6">
            Sign in with Google or connect your wallet to access Nexash
          </p>
          <ConnectButton variant="hero" />
        </div>

      ) : step === 'choose' ? (
        /* Choose type */
        <div className="w-full max-w-lg">
          <h1 className="text-[24px] font-bold text-black tracking-tight text-center mb-2">
            How will you use Nexash?
          </h1>
          <p className="text-[13px] text-neutral-500 text-center mb-8">
            Choose your account type. This cannot be changed later.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Individual */}
            <button
              onClick={() => setStep('individual-register')}
              className="group bg-white border border-neutral-200 rounded-2xl p-6 text-left hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="6" r="3.5" stroke="#4f46e5" strokeWidth="1.2"/>
                  <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="#4f46e5" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="text-[15px] font-semibold text-black mb-1">Individual</h2>
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                Receive ZK-verified payments. Register a username. Verify your KYC identity with Binance.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['@username', 'KYC verified', 'Receive payments'].map(t => (
                  <span key={t} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </button>

            {/* Institution */}
            <button
              onClick={() => setStep('institution-register')}
              className="group bg-white border border-neutral-200 rounded-2xl p-6 text-left hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-neutral-200 transition-colors">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="8" width="14" height="8" rx="1.5" stroke="#111" strokeWidth="1.2"/>
                  <path d="M5 8V6a4 4 0 018 0v2" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M9 12v2M6 12v2M12 12v2" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="text-[15px] font-semibold text-black mb-1">Institution</h2>
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                Deploy and manage compliant treasuries. Send ZK-verified payments with full HSP audit trail.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['Treasury management', 'ZK payments', 'HSP audit'].map(t => (
                  <span key={t} className="text-[10px] bg-neutral-100 text-neutral-600 border border-neutral-200 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            </button>
          </div>
        </div>

      ) : step === 'individual-register' ? (
        /* Individual registration */
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
          <button onClick={() => setStep('choose')} className="text-[12px] text-neutral-400 hover:text-neutral-600 mb-5 flex items-center gap-1">
            ← Back
          </button>
          <h2 className="text-[18px] font-bold text-black mb-1">Choose your username</h2>
          <p className="text-[12px] text-neutral-500 mb-6">
            3–20 characters. Letters, numbers, underscores only. Lowercase.
          </p>

          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-neutral-400">@</span>
            <input
              className="input pl-7"
              placeholder="yourname"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              maxLength={20}
            />
            {username.length >= 3 && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium
                ${checking ? 'text-neutral-400' : available ? 'text-green-600' : 'text-red-500'}`}>
                {checking ? '...' : available ? '✓ available' : '✗ taken'}
              </span>
            )}
          </div>

          {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

          <button
            onClick={handleRegisterIndividual}
            disabled={!username || !available || loading}
            className="btn-primary w-full"
          >
            {loading ? 'Registering...' : 'Register @' + (username || 'username')}
          </button>

          <p className="text-[11px] text-neutral-400 mt-4 text-center">
            You can verify your KYC identity after registration
          </p>
        </div>

      ) : (
        /* Institution registration */
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 w-full max-w-sm shadow-sm">
          <button onClick={() => setStep('choose')} className="text-[12px] text-neutral-400 hover:text-neutral-600 mb-5 flex items-center gap-1">
            ← Back
          </button>
          <h2 className="text-[18px] font-bold text-black mb-1">Register your organisation</h2>
          <p className="text-[12px] text-neutral-500 mb-6">
            Choose a unique handle and display name for your organisation.
          </p>

          <div className="space-y-3 mb-4">
            <div>
              <label className="label">Organisation handle</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-neutral-400">@</span>
                <input
                  className="input pl-7"
                  placeholder="myorg"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength={20}
                />
                {orgName.length >= 3 && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium
                    ${checking ? 'text-neutral-400' : available ? 'text-green-600' : 'text-red-500'}`}>
                    {checking ? '...' : available ? '✓ available' : '✗ taken'}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="label">Display name</label>
              <input
                className="input"
                placeholder="My Organisation Ltd"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={50}
              />
            </div>
            <div>
              <label className="label">Description <span className="text-neutral-400">(optional)</span></label>
              <input
                className="input"
                placeholder="Brief description of your organisation"
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}

          <button
            onClick={handleRegisterOrg}
            disabled={!orgName || !displayName || !available || loading}
            className="btn-primary w-full"
          >
            {loading ? 'Registering...' : 'Register organisation'}
          </button>
        </div>
      )}
    </div>
  )
}
