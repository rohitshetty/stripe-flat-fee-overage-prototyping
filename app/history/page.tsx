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

const EVENT_STYLES: Record<string, { badge: string; icon: JSX.Element }> = {
  usage: {
    badge: 'bg-charcoal-100 text-charcoal-700 border border-charcoal-200',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  subscription_renewal: {
    badge: 'bg-forest-100 text-forest-800 border border-forest-200',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  addon_purchase: {
    badge: 'bg-brass-100 text-brass-800 border border-brass-200',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  subscription_created: {
    badge: 'bg-forest-100 text-forest-800 border border-forest-200',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  subscription_deleted: {
    badge: 'bg-charcoal-100 text-charcoal-600 border border-charcoal-200',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  payment_failed: {
    badge: 'bg-burgundy-100 text-burgundy-700 border border-burgundy-200',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
}

const DEFAULT_STYLE = {
  badge: 'bg-charcoal-100 text-charcoal-700 border border-charcoal-200',
  icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
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

  const getStyle = (eventType: string) => {
    return EVENT_STYLES[eventType] || DEFAULT_STYLE
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-forest-200 border-t-forest-600 animate-spin" />
          <span className="font-body text-charcoal-400">Loading history...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 opacity-0 animate-fade-in">
        <div>
          <h1 className="font-display text-4xl font-semibold text-forest-800 tracking-tight">
            Activity History
          </h1>
          <p className="font-body text-charcoal-500 mt-1">
            A complete record of your account activity
          </p>
        </div>
        <Link href="/" className="btn-ghost group flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span>Back to Dashboard</span>
        </Link>
      </header>

      {/* History List */}
      <div className="card-ledger corner-flourish overflow-hidden opacity-0 animate-slide-up stagger-1">
        {entries.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-charcoal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-body text-charcoal-400">No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-100">
            {entries.map((entry, index) => {
              const style = getStyle(entry.eventType)
              return (
                <div
                  key={entry.id}
                  className={`p-5 hover:bg-ivory-200/50 transition-colors opacity-0 animate-fade-in`}
                  style={{ animationDelay: `${Math.min(index * 0.03, 0.5)}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        entry.creditsChange && entry.creditsChange > 0
                          ? 'bg-forest-100 text-forest-700'
                          : entry.eventType === 'payment_failed'
                          ? 'bg-burgundy-100 text-burgundy-600'
                          : 'bg-charcoal-100 text-charcoal-500'
                      }`}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`badge ${style.badge}`}>
                            {EVENT_LABELS[entry.eventType] || entry.eventType}
                          </span>
                          <span className="font-body text-sm text-charcoal-400">
                            {formatDate(entry.createdAt)}
                          </span>
                        </div>
                        {entry.description && (
                          <p className="mt-2 font-body text-sm text-charcoal-600">{entry.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      {entry.creditsChange !== null && (
                        <div className={`font-mono text-lg font-medium ${
                          entry.creditsChange > 0 ? 'text-forest-700' : 'text-burgundy-600'
                        }`}>
                          {entry.creditsChange > 0 ? '+' : ''}{entry.creditsChange}
                        </div>
                      )}

                      {entry.balanceAfter !== null && (
                        <div className="text-right">
                          <div className="font-body text-xs text-charcoal-400 uppercase tracking-wide">Balance</div>
                          <div className="font-mono text-sm font-medium text-charcoal-700">{entry.balanceAfter}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-between items-center opacity-0 animate-fade-in stagger-2">
        <p className="font-body text-sm text-charcoal-400">
          Showing {entries.length} events
        </p>
        {entries.length > 0 && (
          <div className="flex items-center gap-2 text-charcoal-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="font-body text-xs">Records are kept for 90 days</span>
          </div>
        )}
      </div>
    </div>
  )
}
