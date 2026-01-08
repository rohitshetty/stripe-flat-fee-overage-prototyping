'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

const EVENT_LABELS: Record<string, string> = {
  usage: 'Credit Used',
  subscription_renewal: 'Subscription Renewed',
  addon_purchase: 'Add-on Purchased',
  subscription_change: 'Plan Changed',
  subscription_created: 'Subscription Started',
  subscription_deleted: 'Subscription Ended',
  subscription_cancel_scheduled: 'Cancellation Scheduled',
  subscription_status_change: 'Status Changed',
  subscription_tier_change: 'Tier Changed',
  credits_expired: 'Credits Expired',
  payment_failed: 'Payment Failed',
  manual_adjustment: 'Manual Adjustment',
}

const EVENT_COLORS: Record<string, string> = {
  usage: 'bg-gray-100 text-gray-800',
  subscription_renewal: 'bg-green-100 text-green-800',
  addon_purchase: 'bg-blue-100 text-blue-800',
  subscription_change: 'bg-purple-100 text-purple-800',
  subscription_created: 'bg-green-100 text-green-800',
  subscription_deleted: 'bg-red-100 text-red-800',
  subscription_cancel_scheduled: 'bg-amber-100 text-amber-800',
  credits_expired: 'bg-red-100 text-red-800',
  payment_failed: 'bg-red-100 text-red-800',
  manual_adjustment: 'bg-gray-100 text-gray-800',
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/history?limit=100')
        if (res.ok) {
          const data = await res.json()
          setEntries(data.entries)
        }
      } catch (error) {
        console.error('Failed to fetch history:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Activity History</h1>
        <Link href="/" className="text-sm text-primary-600 hover:text-primary-700">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No activity yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          EVENT_COLORS[entry.eventType] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {EVENT_LABELS[entry.eventType] || entry.eventType}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="mt-1 text-sm text-gray-600">{entry.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 ml-4">
                    {entry.creditsChange !== null && (
                      <div
                        className={`text-sm font-medium ${
                          entry.creditsChange > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {entry.creditsChange > 0 ? '+' : ''}
                        {entry.creditsChange}
                      </div>
                    )}

                    {entry.balanceAfter !== null && (
                      <div className="text-sm text-gray-500">
                        Balance: {entry.balanceAfter}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Showing {entries.length} events
      </div>
    </div>
  )
}
