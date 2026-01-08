'use client'

interface SubscriptionStatusProps {
  tier: string
  status: string
  daysUntilRenewal: number | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

const TIER_NAMES: Record<string, string> = {
  starter: 'Starter',
  expert: 'Expert',
  pro: 'Pro',
}

const TIER_ICONS: Record<string, JSX.Element> = {
  starter: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  expert: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
  pro: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
}

export function SubscriptionStatus({
  tier,
  status,
  daysUntilRenewal,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}: SubscriptionStatusProps) {
  const tierName = TIER_NAMES[tier] || tier
  const tierIcon = TIER_ICONS[tier] || TIER_ICONS.starter

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusBadge = () => {
    if (status === 'none') return <span className="badge badge-neutral">No subscription</span>
    if (status === 'trialing') return <span className="badge badge-brass">Trial</span>
    if (status === 'past_due') return <span className="badge badge-negative">Past due</span>
    if (status === 'canceled') return <span className="badge badge-neutral">Canceled</span>
    return <span className="badge badge-positive">Active</span>
  }

  return (
    <div className="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-3">
      <h2 className="section-header mb-6">Subscription</h2>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-forest-100 border border-forest-200 flex items-center justify-center text-forest-700">
          {tierIcon}
        </div>
        <div>
          <div className="font-display text-2xl font-semibold text-forest-800 capitalize">
            {tierName}
          </div>
          {getStatusBadge()}
        </div>
      </div>

      <div className="divider-brass mb-4" />

      <div className="space-y-3">
        {daysUntilRenewal !== null && status !== 'canceled' && !cancelAtPeriodEnd && (
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-charcoal-500">Renews in</span>
            <span className="font-mono text-sm font-medium text-forest-800">
              {daysUntilRenewal} {daysUntilRenewal === 1 ? 'day' : 'days'}
            </span>
          </div>
        )}

        {currentPeriodEnd && (
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-charcoal-500">
              {cancelAtPeriodEnd ? 'Ends on' : 'Next billing'}
            </span>
            <span className="font-mono text-sm font-medium text-charcoal-700">
              {formatDate(currentPeriodEnd)}
            </span>
          </div>
        )}
      </div>

      {cancelAtPeriodEnd && currentPeriodEnd && (
        <div className="mt-5 notice-warning">
          <p className="font-body text-sm text-brass-800">
            Cancels on {formatDate(currentPeriodEnd)}
          </p>
        </div>
      )}

      {status === 'trialing' && (
        <div className="mt-5 notice-info">
          <p className="font-body text-sm text-forest-800">
            Free trial active
          </p>
        </div>
      )}
    </div>
  )
}
