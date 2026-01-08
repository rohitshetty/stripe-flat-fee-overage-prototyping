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
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Failed to load data</div>
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

      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <Link
            href="/subscription"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Manage Subscription →
          </Link>
        </div>

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
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
