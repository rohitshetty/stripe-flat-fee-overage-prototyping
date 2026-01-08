'use client'

import { useState } from 'react'

interface AddonPack {
  id: string
  name: string
  credits: number
  price: number
}

const ADDON_PACKS: AddonPack[] = [
  { id: 'small', name: 'Small', credits: 3, price: 25 },
  { id: 'medium', name: 'Medium', credits: 10, price: 70 },
  { id: 'large', name: 'Large', credits: 25, price: 150 },
]

interface AddonPurchaseProps {
  canPurchase: boolean
  onPurchase: (packId: string) => Promise<{ url?: string; error?: string }>
}

export function AddonPurchase({ canPurchase, onPurchase }: AddonPurchaseProps) {
  const [loadingPack, setLoadingPack] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePurchase = async (packId: string) => {
    setLoadingPack(packId)
    setError(null)

    try {
      const result = await onPurchase(packId)

      if (result.url) {
        window.location.href = result.url
      } else if (result.error) {
        setError(result.error)
      }
    } catch {
      setError('Failed to start checkout')
    } finally {
      setLoadingPack(null)
    }
  }

  const getPackIcon = (packId: string) => {
    if (packId === 'small') return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    )
    if (packId === 'medium') return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    )
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
      </svg>
    )
  }

  return (
    <div className="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-5">
      <h2 className="section-header mb-6">Add-on Packs</h2>

      {!canPurchase && (
        <div className="notice-warning mb-6">
          <p className="font-body text-sm text-brass-800">
            Active subscription required to purchase add-ons.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {ADDON_PACKS.map((pack, index) => (
          <div
            key={pack.id}
            className={`flex items-center justify-between py-4 ${
              index < ADDON_PACKS.length - 1 ? 'border-b border-charcoal-100' : ''
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brass-100 border border-brass-200 flex items-center justify-center text-brass-700">
                {getPackIcon(pack.id)}
              </div>
              <div>
                <div className="font-display text-lg font-semibold text-charcoal-800">{pack.name}</div>
                <div className="font-body text-sm text-charcoal-500">
                  {pack.credits} credits
                  <span className="text-brass-600 ml-1">
                    (${(pack.price / pack.credits).toFixed(2)}/ea)
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => handlePurchase(pack.id)}
              disabled={!canPurchase || loadingPack !== null}
              className={`px-5 py-2 font-mono text-sm font-medium transition-all ${
                !canPurchase || loadingPack !== null
                  ? 'text-charcoal-300 cursor-not-allowed'
                  : 'text-forest-800 border border-forest-300 hover:bg-forest-50 hover:border-forest-500'
              }`}
            >
              {loadingPack === pack.id ? (
                <span className="flex items-center gap-2">
                  <svg className="spinner h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </span>
              ) : (
                `$${pack.price}`
              )}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 notice-danger">
          <p className="font-body text-sm text-burgundy-700">{error}</p>
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-charcoal-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p className="font-body text-xs">
          Add-on credits never expire
        </p>
      </div>
    </div>
  )
}
