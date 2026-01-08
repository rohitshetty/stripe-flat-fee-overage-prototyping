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
  { id: 'starter', name: 'Starter', price: 10, credits: 1, description: 'Perfect for getting started' },
  { id: 'expert', name: 'Expert', price: 15, credits: 5, description: 'Best for regular users', popular: true },
  { id: 'pro', name: 'Pro', price: 20, credits: 10, description: 'For power users' },
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
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-forest-200 border-t-forest-600 animate-spin" />
          <span className="font-body text-charcoal-400">Loading...</span>
        </div>
      </div>
    )
  }

  const hasActiveSubscription = subscription && ['active', 'trialing'].includes(subscription.status)
  const canPurchaseAddons = hasActiveSubscription && !subscription?.cancelAtPeriodEnd

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 opacity-0 animate-fade-in">
        <div>
          <h1 className="font-display text-4xl font-semibold text-forest-800 tracking-tight">
            Subscription
          </h1>
          <p className="font-body text-charcoal-500 mt-1">
            Choose a plan that works for you
          </p>
        </div>
        <Link href="/" className="btn-ghost group flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span>Back to Dashboard</span>
        </Link>
      </header>

      {error && (
        <div className="mb-8 notice-danger opacity-0 animate-slide-up">
          <p className="font-body text-sm text-burgundy-700">{error}</p>
        </div>
      )}

      {/* Current Plan Section */}
      {hasActiveSubscription && (
        <div className="card-ledger corner-flourish p-8 mb-8 opacity-0 animate-slide-up stagger-1">
          <h2 className="section-header mb-6">Current Plan</h2>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-forest-100 border border-forest-200 flex items-center justify-center">
                <svg className="w-7 h-7 text-forest-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <div>
                <div className="font-display text-2xl font-semibold text-forest-800 capitalize">
                  {subscription?.tier} Plan
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {subscription?.status === 'trialing' ? (
                    <span className="badge badge-brass">Trial Active</span>
                  ) : (
                    <span className="badge badge-positive">Active</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleManageSubscription}
              className="btn-primary"
            >
              Manage Subscription
            </button>
          </div>

          {subscription?.cancelAtPeriodEnd && subscription?.currentPeriodEnd && (
            <div className="mt-6 notice-warning">
              <p className="font-body text-sm text-brass-800">
                Your subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Choose Plan Section */}
      {!hasActiveSubscription && (
        <div className="mb-8 opacity-0 animate-slide-up stagger-1">
          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map((tier, index) => (
              <div
                key={tier.id}
                className={`card-ledger p-6 flex flex-col relative ${
                  tier.popular ? 'ring-2 ring-brass-400' : ''
                } opacity-0 animate-slide-up stagger-${index + 2}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge badge-brass px-3 py-1">Most Popular</span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-display text-xl font-semibold text-forest-800">{tier.name}</h3>
                  <p className="font-body text-sm text-charcoal-500 mt-1">{tier.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-4xl font-medium text-forest-800">${tier.price}</span>
                    <span className="font-body text-charcoal-400">/month</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <svg className="w-4 h-4 text-brass-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                    </svg>
                    <span className="font-body text-sm text-charcoal-600">
                      {tier.credits} credit{tier.credits > 1 ? 's' : ''}/month
                    </span>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <button
                    onClick={() => handleSubscribe(tier.id, true)}
                    disabled={checkoutLoading !== null}
                    className={`w-full ${tier.popular ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {checkoutLoading === tier.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="spinner h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </span>
                    ) : (
                      'Start 14-Day Trial'
                    )}
                  </button>
                  <button
                    onClick={() => handleSubscribe(tier.id, false)}
                    disabled={checkoutLoading !== null}
                    className="w-full btn-ghost text-center py-2"
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
      <div className="mt-8 card-ledger p-6 opacity-0 animate-slide-up stagger-6">
        <h3 className="section-header mb-4">How it works</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: '1', text: 'Subscription credits reset each billing cycle' },
            { icon: '2', text: 'Add-on credits never expire' },
            { icon: '3', text: 'Subscription credits are used first' },
            { icon: '4', text: 'Upgrade anytime for more credits' },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-forest-100 border border-forest-200 flex items-center justify-center">
                <span className="font-mono text-xs text-forest-700">{item.icon}</span>
              </div>
              <span className="font-body text-sm text-charcoal-600">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
