'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { CreditDisplay } from '@/components/CreditDisplay'
import { ActionButton } from '@/components/ActionButton'
import { SubscriptionStatus } from '@/components/SubscriptionStatus'
import { ActivityLog } from '@/components/ActivityLog'
import { GracePeriodBanner } from '@/components/GracePeriodBanner'
import { Toast } from '@/components/Toast'
import Link from 'next/link'

interface UserStatus {
  user: {
    id: number
    email: string
    stripeCustomerId: string | null
  }
  credits: {
    subscription: number
    addon: number
    total: number
  }
  subscription: {
    tier: string
    status: string
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    daysUntilRenewal: number | null
    isInGracePeriod: boolean
    gracePeriodEndsAt: string | null
    trialEnd: string | null
  }
  actionCount: number
}

interface HistoryEntry {
  id: number
  eventType: string
  creditsChange: number | null
  creditType: string | null
  balanceBefore: number | null
  balanceAfter: number | null
  description: string | null
  createdAt: string
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<UserStatus | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch('/api/user/status'),
        fetch('/api/history?limit=5'),
      ])

      if (statusRes.ok) {
        setStatus(await statusRes.json())
      }

      if (historyRes.ok) {
        const data = await historyRes.json()
        setHistory(data.entries)
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

  // Handle checkout/addon success params
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const addon = searchParams.get('addon')

    if (checkout === 'success') {
      setToast({ message: 'Subscription successful!', type: 'success' })
      // Refresh data after a delay to allow webhook processing
      setTimeout(fetchData, 2000)
    } else if (checkout === 'canceled') {
      setToast({ message: 'Checkout canceled', type: 'info' })
    } else if (addon === 'success') {
      setToast({ message: 'Add-on credits purchased!', type: 'success' })
      setTimeout(fetchData, 2000)
    } else if (addon === 'canceled') {
      setToast({ message: 'Add-on purchase canceled', type: 'info' })
    }
  }, [searchParams, fetchData])

  const handleUseCredit = async () => {
    const res = await fetch('/api/credits/use', { method: 'POST' })
    const data = await res.json()

    if (res.ok) {
      // Update local state
      setStatus(prev => prev ? {
        ...prev,
        credits: data.credits,
        actionCount: data.actionCount,
      } : null)

      // Refresh history
      const historyRes = await fetch('/api/history?limit=5')
      if (historyRes.ok) {
        const historyData = await historyRes.json()
        setHistory(historyData.entries)
      }
    }

    return {
      success: res.ok,
      actionCount: data.actionCount,
      error: data.error,
    }
  }

  const handleUpdatePayment = async () => {
    const res = await fetch('/api/portal')
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
      {status.subscription.isInGracePeriod && status.subscription.gracePeriodEndsAt && (
        <GracePeriodBanner
          gracePeriodEndsAt={status.subscription.gracePeriodEndsAt}
          onUpdatePayment={handleUpdatePayment}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-12 opacity-0 animate-fade-in">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-4xl font-semibold text-forest-800 tracking-tight">
                Dashboard
              </h1>
              <span className="badge badge-forest">Pre-Pay</span>
            </div>
            <p className="font-body text-charcoal-500">
              Manage your credits and subscription
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/subscription" className="btn-ghost">
              Subscription
            </Link>
            <span className="text-charcoal-300">|</span>
            <Link href="/native" className="btn-ghost">
              Native
            </Link>
            <Link href="/compare" className="btn-secondary">
              Compare
            </Link>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <CreditDisplay
            subscriptionCredits={status.credits.subscription}
            addonCredits={status.credits.addon}
            totalCredits={status.credits.total}
          />

          <ActionButton
            actionCount={status.actionCount}
            totalCredits={status.credits.total}
            hasActiveSubscription={hasActiveSubscription}
            onUseCredit={handleUseCredit}
          />

          <SubscriptionStatus
            tier={status.subscription.tier}
            status={status.subscription.status}
            daysUntilRenewal={status.subscription.daysUntilRenewal}
            cancelAtPeriodEnd={status.subscription.cancelAtPeriodEnd}
            currentPeriodEnd={status.subscription.currentPeriodEnd}
          />

          <ActivityLog entries={history} limit={5} />
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-charcoal-100 opacity-0 animate-fade-in stagger-6">
          <div className="flex justify-between items-center text-charcoal-400">
            <p className="font-body text-xs">
              Ledger Credit Management
            </p>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-forest-400 animate-pulse" />
              <span className="font-body text-xs">All systems operational</span>
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

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-forest-200 border-t-forest-600 animate-spin" />
          <span className="font-body text-charcoal-400">Loading...</span>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
