'use client'

interface SubscriptionStatusProps {
  tier: string
  status: string
  daysUntilRenewal: number | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  trialing: 'bg-blue-100 text-blue-800',
  past_due: 'bg-amber-100 text-amber-800',
  canceled: 'bg-red-100 text-red-800',
  none: 'bg-gray-100 text-gray-800',
}

const TIER_NAMES: Record<string, string> = {
  starter: 'Starter',
  expert: 'Expert',
  pro: 'Pro',
}

export function SubscriptionStatus({
  tier,
  status,
  daysUntilRenewal,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: SubscriptionStatusProps) {
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.none
  const tierName = TIER_NAMES[tier] || tier

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Subscription</h2>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Plan</span>
          <span className="font-medium text-gray-900">{tierName}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">Status</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {status === 'none' ? 'No subscription' : status}
          </span>
        </div>

        {daysUntilRenewal !== null && status !== 'canceled' && !cancelAtPeriodEnd && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Renews in</span>
            <span className="font-medium text-gray-900">
              {daysUntilRenewal} {daysUntilRenewal === 1 ? 'day' : 'days'}
            </span>
          </div>
        )}

        {currentPeriodEnd && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">
              {cancelAtPeriodEnd ? 'Ends on' : 'Next billing'}
            </span>
            <span className="font-medium text-gray-900">
              {formatDate(currentPeriodEnd)}
            </span>
          </div>
        )}
      </div>

      {cancelAtPeriodEnd && currentPeriodEnd && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-sm text-amber-800">
            Subscription cancels on {formatDate(currentPeriodEnd)}
          </p>
        </div>
      )}

      {status === 'trialing' && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            You&apos;re on a free trial
          </p>
        </div>
      )}
    </div>
  )
}
