'use client'

interface ActivityEntry {
  id: number
  eventType: string
  creditsChange: number | null
  creditType: string | null
  balanceBefore: number | null
  balanceAfter: number | null
  description: string | null
  createdAt: string
}

interface ActivityLogProps {
  entries: ActivityEntry[]
  limit?: number
}

const EVENT_LABELS: Record<string, string> = {
  usage: 'Used',
  subscription_renewal: 'Renewed',
  addon_purchase: 'Purchased',
  subscription_change: 'Changed',
  subscription_created: 'Started',
  subscription_deleted: 'Ended',
  subscription_cancel_scheduled: 'Scheduled',
  subscription_status_change: 'Status',
  subscription_tier_change: 'Tier',
  credits_expired: 'Expired',
  payment_failed: 'Failed',
  manual_adjustment: 'Adjusted',
}

const EVENT_ICONS: Record<string, JSX.Element> = {
  usage: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  subscription_renewal: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  addon_purchase: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  payment_failed: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
}

export function ActivityLog({ entries, limit = 5 }: ActivityLogProps) {
  const displayEntries = entries.slice(0, limit)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getIcon = (eventType: string) => {
    return EVENT_ICONS[eventType] || (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-4">
        <h2 className="section-header mb-6">Activity</h2>
        <div className="flex flex-col items-center justify-center py-8 text-charcoal-400">
          <svg className="w-8 h-8 mb-2 text-charcoal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-body text-sm">No activity yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-4">
      <h2 className="section-header mb-6">Activity</h2>

      <div className="space-y-0">
        {displayEntries.map((entry, index) => (
          <div
            key={entry.id}
            className={`flex items-center justify-between py-3 ${
              index < displayEntries.length - 1 ? 'border-b border-charcoal-100' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                entry.creditsChange && entry.creditsChange > 0
                  ? 'bg-forest-100 text-forest-700'
                  : entry.eventType === 'payment_failed'
                  ? 'bg-burgundy-100 text-burgundy-600'
                  : 'bg-charcoal-100 text-charcoal-500'
              }`}>
                {getIcon(entry.eventType)}
              </div>
              <div>
                <span className="font-body text-sm text-charcoal-800">
                  {EVENT_LABELS[entry.eventType] || entry.eventType}
                </span>
                <span className="font-body text-xs text-charcoal-400 ml-2">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
            </div>
            {entry.creditsChange !== null && (
              <span className={entry.creditsChange > 0 ? 'credit-positive' : 'credit-negative'}>
                {entry.creditsChange > 0 ? '+' : ''}{entry.creditsChange}
              </span>
            )}
          </div>
        ))}
      </div>

      {entries.length > limit && (
        <a
          href="/history"
          className="block mt-5 text-center btn-ghost group"
        >
          <span>View all activity</span>
          <svg className="inline-block w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
      )}
    </div>
  )
}
