'use client'

/**
 * Native Implementation: Subscription Page
 *
 * Plan selection with flat fee + included actions.
 * No addon packs - overages replace the need for addons.
 *
 * Compare to: app/subscription/page.tsx (has addon packs section)
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { NATIVE_TIERS, NativeTierName } from '@/lib/native/constants'
import { Toast } from '@/components/Toast'

interface NativeStatus {
  user: { stripeCustomerId: string | null }
  subscription: {
    tier: string
    status: string
  }
}

// Tier order for upgrade/downgrade comparison
const TIER_ORDER: NativeTierName[] = ['starter', 'expert', 'pro']

export default function NativeSubscriptionPage() {
  const [status, setStatus] = useState<NativeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [changeLoading, setChangeLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/native/status')
    if (res.ok) {
      setStatus(await res.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubscribe = async (tier: NativeTierName, includeTrial: boolean = false) => {
    setCheckoutLoading(tier)
    try {
      const res = await fetch('/api/native/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, includeTrial }),
      })

      if (res.ok) {
        const data = await res.json()
        window.location.href = data.url
      } else {
        const data = await res.json()
        setToast({ message: data.error || 'Failed to start checkout', type: 'error' })
      }
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleManageSubscription = async () => {
    const res = await fetch('/api/native/portal')
    if (res.ok) {
      const data = await res.json()
      window.location.href = data.url
    }
  }

  const handleChangeTier = async (newTier: NativeTierName) => {
    setChangeLoading(newTier)
    try {
      const res = await fetch('/api/native/subscription/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newTier }),
      })

      const data = await res.json()

      if (res.ok) {
        setToast({ message: data.message, type: 'success' })
        fetchData() // Refresh data
      } else {
        setToast({ message: data.error || 'Failed to change plan', type: 'error' })
      }
    } catch {
      setToast({ message: 'Something went wrong', type: 'error' })
    } finally {
      setChangeLoading(null)
    }
  }

  const getTierComparison = (tierKey: NativeTierName): 'current' | 'upgrade' | 'downgrade' | null => {
    if (!status || !hasActiveSubscription) return null
    const currentTier = status.subscription.tier as NativeTierName
    if (tierKey === currentTier) return 'current'
    const currentIndex = TIER_ORDER.indexOf(currentTier)
    const targetIndex = TIER_ORDER.indexOf(tierKey)
    return targetIndex > currentIndex ? 'upgrade' : 'downgrade'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-forest-200 border-t-forest-600 animate-spin" />
      </div>
    )
  }

  const hasActiveSubscription = status && ['active', 'trialing'].includes(status.subscription.status)
  const tiers = Object.entries(NATIVE_TIERS) as [NativeTierName, typeof NATIVE_TIERS[NativeTierName]][]

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 opacity-0 animate-fade-in">
        <div>
          <h1 className="font-display text-4xl font-semibold text-forest-800 tracking-tight">
            Choose Your Plan
          </h1>
          <p className="font-body text-charcoal-500 mt-1">
            Flat monthly fee + pay-per-use overages
          </p>
        </div>
        <Link href="/native" className="btn-ghost group flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span>Back to Dashboard</span>
        </Link>
      </header>

      {/* Active Subscription Banner */}
      {hasActiveSubscription && (
        <div className="card-ledger p-6 mb-8 opacity-0 animate-slide-up">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-body text-sm text-charcoal-500">Current Plan</p>
              <p className="font-display text-xl font-semibold text-forest-800 capitalize">
                {status.subscription.tier}
              </p>
            </div>
            <button onClick={handleManageSubscription} className="btn-secondary">
              Manage in Stripe Portal
            </button>
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {tiers.map(([tierKey, tierConfig], index) => {
          const isCurrentTier = hasActiveSubscription && status.subscription.tier === tierKey
          const isPopular = tierKey === 'expert'

          return (
            <div
              key={tierKey}
              className={`card-ledger p-6 opacity-0 animate-slide-up relative ${
                isPopular ? 'ring-2 ring-brass-400' : ''
              }`}
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge badge-brass">Most Popular</span>
                </div>
              )}

              {isCurrentTier && (
                <div className="absolute -top-3 right-4">
                  <span className="badge badge-forest">Current</span>
                </div>
              )}

              <div className="text-center mb-6 pt-2">
                <h3 className="font-display text-2xl font-semibold text-forest-800">
                  {tierConfig.name}
                </h3>
                <div className="mt-2">
                  <span className="font-display text-4xl font-bold text-forest-800">
                    ${(tierConfig.licenseFee / 100).toFixed(0)}
                  </span>
                  <span className="font-body text-charcoal-400">/month</span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between py-2 border-b border-charcoal-100">
                  <span className="font-body text-sm text-charcoal-500">Included actions</span>
                  <span className="font-mono text-sm font-medium text-forest-800">
                    {tierConfig.includedActions}/month
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-charcoal-100">
                  <span className="font-body text-sm text-charcoal-500">Overage rate</span>
                  <span className="font-mono text-sm font-medium text-brass-700">
                    ${(tierConfig.overageRate / 100).toFixed(2)}/action
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-body text-sm text-charcoal-500">Effective cost</span>
                  <span className="font-mono text-sm text-charcoal-400">
                    ${(tierConfig.licenseFee / tierConfig.includedActions / 100).toFixed(2)}/action base
                  </span>
                </div>
              </div>

              {!hasActiveSubscription && (
                <div className="space-y-2">
                  <button
                    onClick={() => handleSubscribe(tierKey, true)}
                    disabled={checkoutLoading !== null}
                    className="btn-primary w-full"
                  >
                    {checkoutLoading === tierKey ? 'Loading...' : 'Start 14-Day Trial'}
                  </button>
                  <button
                    onClick={() => handleSubscribe(tierKey, false)}
                    disabled={checkoutLoading !== null}
                    className="btn-ghost w-full text-sm"
                  >
                    Subscribe Now
                  </button>
                </div>
              )}

              {isCurrentTier && (
                <div className="text-center py-3 bg-forest-50 rounded-lg">
                  <span className="font-body text-sm text-forest-700">Your current plan</span>
                </div>
              )}

              {hasActiveSubscription && !isCurrentTier && (
                <button
                  onClick={() => handleChangeTier(tierKey)}
                  disabled={changeLoading !== null}
                  className={`w-full ${
                    getTierComparison(tierKey) === 'upgrade' ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {changeLoading === tierKey ? (
                    'Processing...'
                  ) : getTierComparison(tierKey) === 'upgrade' ? (
                    <>
                      <span>Upgrade to {tierConfig.name}</span>
                      <svg className="inline-block w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>Downgrade to {tierConfig.name}</span>
                      <svg className="inline-block w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Comparison to Credits */}
      <div className="card-ledger p-8 opacity-0 animate-slide-up stagger-4">
        <h2 className="section-header mb-6">Native vs Credits Model</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-body text-sm font-medium text-brass-700 mb-3">This Model (Native)</h3>
            <ul className="space-y-2 font-body text-sm text-charcoal-600">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-forest-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Never blocked - use what you need
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-forest-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Pay only for overages at cycle end
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-forest-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Stripe handles all billing
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-body text-sm font-medium text-charcoal-500 mb-3">Credits Model</h3>
            <ul className="space-y-2 font-body text-sm text-charcoal-500">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-charcoal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Blocked when credits = 0
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-charcoal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Must purchase add-on packs
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-charcoal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Complex credit tracking logic
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-charcoal-100">
          <Link href="/compare" className="btn-secondary">
            View Full Comparison
          </Link>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
