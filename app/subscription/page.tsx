'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AddonPurchase } from '@/components/AddonPurchase'

interface SubscriptionData {
  tier: string
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEnd: string | null
}

const TIERS = [
  { id: 'starter', name: 'Starter', price: 10, credits: 1 },
  { id: 'expert', name: 'Expert', price: 15, credits: 5 },
  { id: 'pro', name: 'Pro', price: 20, credits: 10 },
]

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/user/status')
        if (res.ok) {
          const data = await res.json()
          setSubscription(data.subscription)
        }
      } catch {
        setError('Failed to load subscription data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSubscribe = async (tier: string, includeTrial: boolean = false) => {
    setCheckoutLoading(tier)
    setError(null)

    try {
      const res = await fetch('/api/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, includeTrial }),
      })

      const data = await res.json()

      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to start checkout')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/portal')
      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to open portal')
      }
    } catch {
      setError('Something went wrong')
    }
  }

  const handlePurchaseAddon = async (packId: string) => {
    const res = await fetch('/api/checkout/addon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pack: packId }),
    })

    const data = await res.json()
    return { url: data.url, error: data.error }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  const hasActiveSubscription = subscription && ['active', 'trialing'].includes(subscription.status)
  const canPurchaseAddons = hasActiveSubscription && !subscription?.cancelAtPeriodEnd

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Subscription Management</h1>
        <Link href="/" className="text-sm text-primary-600 hover:text-primary-700">
          ← Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Current Plan Section */}
      {hasActiveSubscription && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Current Plan</h2>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xl font-semibold text-gray-900 capitalize">
                {subscription?.tier} Plan
              </div>
              <div className="text-sm text-gray-500">
                {subscription?.status === 'trialing' ? 'Trial' : 'Active subscription'}
              </div>
            </div>
            <button
              onClick={handleManageSubscription}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Manage Subscription
            </button>
          </div>

          {subscription?.cancelAtPeriodEnd && subscription?.currentPeriodEnd && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">
                Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Choose Plan Section */}
      {!hasActiveSubscription && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Choose a Plan</h2>

          <div className="grid md:grid-cols-3 gap-4">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className="border border-gray-200 rounded-lg p-4 flex flex-col"
              >
                <div className="font-medium text-gray-900">{tier.name}</div>
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  ${tier.price}
                  <span className="text-sm font-normal text-gray-500">/month</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {tier.credits} credit{tier.credits > 1 ? 's' : ''}/month
                </div>
                <div className="mt-auto pt-4 space-y-2">
                  <button
                    onClick={() => handleSubscribe(tier.id, true)}
                    disabled={checkoutLoading !== null}
                    className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      checkoutLoading === tier.id
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {checkoutLoading === tier.id ? 'Loading...' : 'Start 14-Day Trial'}
                  </button>
                  <button
                    onClick={() => handleSubscribe(tier.id, false)}
                    disabled={checkoutLoading !== null}
                    className="w-full py-2 px-4 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Subscribe Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add-on Packs */}
      <AddonPurchase
        canPurchase={!!canPurchaseAddons}
        onPurchase={handlePurchaseAddon}
      />

      {/* Info Section */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">How it works</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Subscription credits reset each billing cycle</li>
          <li>• Add-on credits never expire</li>
          <li>• Subscription credits are used first</li>
          <li>• Upgrade anytime for more credits</li>
        </ul>
      </div>
    </div>
  )
}
