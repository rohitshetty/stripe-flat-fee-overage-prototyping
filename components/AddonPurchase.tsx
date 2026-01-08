'use client'

import { useState } from 'react'

interface AddonPack {
  id: string
  name: string
  credits: number
  price: number
}

const ADDON_PACKS: AddonPack[] = [
  { id: 'small', name: 'Small Pack', credits: 3, price: 25 },
  { id: 'medium', name: 'Medium Pack', credits: 10, price: 70 },
  { id: 'large', name: 'Large Pack', credits: 25, price: 150 },
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Add-on Credit Packs</h2>

      {!canPurchase && (
        <p className="text-sm text-gray-500 mb-4">
          You need an active subscription to purchase add-ons.
        </p>
      )}

      <div className="space-y-3">
        {ADDON_PACKS.map((pack) => (
          <div
            key={pack.id}
            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
          >
            <div>
              <div className="font-medium text-gray-900">{pack.name}</div>
              <div className="text-sm text-gray-500">
                {pack.credits} credits &middot; ${(pack.price / pack.credits).toFixed(2)}/credit
              </div>
            </div>
            <button
              onClick={() => handlePurchase(pack.id)}
              disabled={!canPurchase || loadingPack !== null}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !canPurchase || loadingPack !== null
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {loadingPack === pack.id ? 'Loading...' : `$${pack.price}`}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Add-on credits never expire and are used after subscription credits.
      </p>
    </div>
  )
}
