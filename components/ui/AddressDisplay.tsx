'use client'

import { useState } from 'react'
import { getExplorerAddressUrl } from '@/lib/contracts/client'

interface AddressDisplayProps {
  address: string
  truncate?: boolean
  showCopy?: boolean
  showExplorer?: boolean
  className?: string
}

export function AddressDisplay({
  address,
  truncate = true,
  showCopy = true,
  showExplorer = false,
  className = '',
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false)

  const display = truncate
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address

  const copy = async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs text-text-secondary ${className}`}>
      {display}
      {showCopy && (
        <button
          onClick={copy}
          className="text-text-muted hover:text-text-secondary transition-colors"
          title="Copy address"
        >
          {copied ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1"/>
              <path d="M8 4V2a1 1 0 00-1-1H2a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="currentColor" strokeWidth="1"/>
            </svg>
          )}
        </button>
      )}
      {showExplorer && (
        <a
          href={getExplorerAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-brand-500 transition-colors"
          title="View on explorer"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M4.5 2H2a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V6.5M7 1h3m0 0v3m0-3L4.5 6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      )}
    </span>
  )
}
