'use client'

/**
 * Native Implementation: Dashboard Page
 *
 * Main dashboard showing usage-based billing info.
 * Compare to: app/page.tsx (credits-based dashboard)
 */

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { UsageDisplay, NativeActionButton, SubscriptionCard } from '@/components/native'
import { Toast } from '@/components/Toast'
import { NativeTierName } from '@/lib/native/constants'

interface NativeStatus {
  user: {
    id: number
    email: string
    stripeCustomerId: string | null
  }
  subscription: {
    tier: string
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    daysUntilRenewal: number | null
  }
  usage: {
    totalActions: number
    includedActions: number
    overageCount: number
    estimatedOverageCharge: number
  }
  localActionCount: number
  dataRefreshedAt: string
}

function NativeDashboardContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<NativeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/native/status')
      if (res.ok) {
        setStatus(await res.json())
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle checkout success params
  useEffect(() => {
    const checkout = searchParams.get('checkout')

    if (checkout === 'success') {
      setToast({ message: 'Subscription successful!', type: 'success' })
      setTimeout(fetchData, 2000)
    } else if (checkout === 'canceled') {
      setToast({ message: 'Checkout canceled', type: 'info' })
    }
  }, [searchParams, fetchData])

  const handlePerformAction = async () => {
    const res = await fetch('/api/native/action', { method: 'POST' })
    const data = await res.json()
    return { success: res.ok, error: data.error }
  }

  // Delayed refetch to allow Stripe Meters aggregation time
  const handleActionComplete = useCallback(() => {
    // Stripe Meters have aggregation delay - wait before refetching
    setTimeout(fetchData, 1500)
  }, [fetchData])

  const handleManageSubscription = async () => {
    const res = await fetch('/api/native/portal')
    if (res.ok) {
      const data = await res.json()
      window.location.href = data.url
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-forest-200 border-t-forest-600 animate-spin" />
          <span className="font-body text-charcoal-400">Loading your dashboard...</span>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-ledger p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-burgundy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="font-body text-charcoal-600">Failed to load data</p>
        </div>
      </div>
    )
  }

  const hasActiveSubscription = ['active', 'trialing', 'past_due'].includes(status.subscription.status)

  return (
    <>
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-12 opacity-0 animate-fade-in">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-4xl font-semibold text-forest-800 tracking-tight">
                Native Dashboard
              </h1>
              <span className="badge badge-brass">Post-Pay</span>
            </div>
            <p className="font-body text-charcoal-500">
              Stripe-native usage billing - pay only for what you use
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/native/subscription" className="btn-ghost">
              Subscription
            </Link>
            <span className="text-charcoal-300">|</span>
            <Link href="/" className="btn-ghost">
              Credits
            </Link>
            <Link href="/compare" className="btn-secondary">
              Compare
            </Link>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <UsageDisplay
            totalActions={status.usage.totalActions}
            includedActions={status.usage.includedActions}
            overageCount={status.usage.overageCount}
            estimatedOverageCharge={status.usage.estimatedOverageCharge}
            dataRefreshedAt={status.dataRefreshedAt}
          />

          <NativeActionButton
            hasActiveSubscription={hasActiveSubscription}
            onPerformAction={handlePerformAction}
            onActionComplete={handleActionComplete}
          />

          <SubscriptionCard
            tier={status.subscription.tier as NativeTierName}
            status={status.subscription.status}
            currentPeriodEnd={status.subscription.currentPeriodEnd}
            daysUntilRenewal={status.subscription.daysUntilRenewal}
          />

          {/* Info Card */}
          <div className="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-4">
            <h2 className="section-header mb-4">How It Works</h2>
            <ul className="space-y-3 font-body text-sm text-charcoal-600">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-forest-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Actions are never blocked - use as many as you need</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-forest-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Included actions are billed at $0 (part of your flat fee)</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-brass-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Overages are charged at your tier rate at cycle end</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-forest-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Stripe tracks all usage automatically via Meters</span>
              </li>
            </ul>

            {hasActiveSubscription && (
              <button
                onClick={handleManageSubscription}
                className="btn-secondary w-full mt-6"
              >
                Manage in Stripe Portal
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-charcoal-100 opacity-0 animate-fade-in stagger-6">
          <div className="flex justify-between items-center text-charcoal-400">
            <p className="font-body text-xs">
              Native Billing Implementation
            </p>
            <div className="flex items-center gap-4">
              <Link href="/native/history" className="font-body text-xs hover:text-forest-600 transition-colors">
                View History
              </Link>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-brass-400 animate-pulse" />
                <span className="font-body text-xs">Stripe Meters Active</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}

export default function NativeDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-forest-200 border-t-forest-600 animate-spin" />
          <span className="font-body text-charcoal-400">Loading...</span>
        </div>
      </div>
    }>
      <NativeDashboardContent />
    </Suspense>
  )
}
