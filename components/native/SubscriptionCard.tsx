'use client'

/**
 * Native Implementation: Subscription Card
 *
 * Displays tier info with included actions and overage rate.
 */

import { NATIVE_TIERS, NativeTierName } from '@/lib/native/constants'

interface SubscriptionCardProps {
  tier: NativeTierName
  status: string
  currentPeriodEnd: string | null
  daysUntilRenewal: number | null
}

export function SubscriptionCard({
  tier,
  status,
  currentPeriodEnd,
  daysUntilRenewal,
}: SubscriptionCardProps) {
  const tierConfig = NATIVE_TIERS[tier]
  const isActive = ['active', 'trialing'].includes(status)

  const statusColors: Record<string, string> = {
    active: 'badge-forest',
    trialing: 'badge-brass',
    past_due: 'badge-burgundy',
    canceled: 'badge-charcoal',
    none: 'badge-charcoal',
  }

  const statusLabels: Record<string, string> = {
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
    none: 'No Subscription',
  }

  return (
    <div className="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-3">
      <div className="flex justify-between items-start mb-6">
        <h2 className="section-header">Subscription</h2>
        <span className={`badge ${statusColors[status] || 'badge-charcoal'}`}>
          {statusLabels[status] || status}
        </span>
      </div>

      {isActive && tierConfig && (
        <>
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold text-forest-800">
                {tierConfig.name}
              </span>
              <span className="font-body text-charcoal-400">plan</span>
            </div>
            <p className="mt-1 font-mono text-sm text-charcoal-500">
              ${(tierConfig.licenseFee / 100).toFixed(2)}/month
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-charcoal-100">
              <span className="font-body text-sm text-charcoal-500">Included actions</span>
              <span className="font-mono text-sm font-medium text-forest-800">
                {tierConfig.includedActions}/month
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-charcoal-100">
              <span className="font-body text-sm text-charcoal-500">Overage rate</span>
              <span className="font-mono text-sm font-medium text-brass-700">
                ${(tierConfig.overageRate / 100).toFixed(2)}/action
              </span>
            </div>
            {daysUntilRenewal !== null && (
              <div className="flex justify-between items-center py-2">
                <span className="font-body text-sm text-charcoal-500">Next billing</span>
                <span className="font-mono text-sm font-medium text-forest-800">
                  {daysUntilRenewal === 0 ? 'Today' : `${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''}`}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {!isActive && (
        <div className="text-center py-8">
          <p className="font-body text-charcoal-400">
            {status === 'canceled' ? 'Your subscription has ended' : 'No active subscription'}
          </p>
        </div>
      )}
    </div>
  )
}
