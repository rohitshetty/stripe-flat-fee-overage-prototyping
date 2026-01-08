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
  usage: 'text-gray-600',
  subscription_renewal: 'text-green-600',
  addon_purchase: 'text-blue-600',
  subscription_change: 'text-purple-600',
  subscription_created: 'text-green-600',
  subscription_deleted: 'text-red-600',
  subscription_cancel_scheduled: 'text-amber-600',
  credits_expired: 'text-red-600',
  payment_failed: 'text-red-600',
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

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <p className="text-sm text-gray-500">No activity yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>

      <div className="space-y-3">
        {displayEntries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${EVENT_COLORS[entry.eventType] || 'text-gray-600'}`}>
                {EVENT_LABELS[entry.eventType] || entry.eventType}
              </div>
              {entry.description && (
                <div className="text-xs text-gray-500 truncate">
                  {entry.description}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 ml-4">
              {entry.creditsChange !== null && (
                <span className={`text-sm font-medium ${
                  entry.creditsChange > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {entry.creditsChange > 0 ? '+' : ''}{entry.creditsChange}
                </span>
              )}
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {formatDate(entry.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {entries.length > limit && (
        <a
          href="/history"
          className="block mt-4 text-sm text-primary-600 hover:text-primary-700"
        >
          View all activity →
        </a>
      )}
    </div>
  )
}
