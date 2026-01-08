'use client'

/**
 * Native Implementation: Usage Display
 *
 * Shows usage vs included actions, overage count, and estimated charge.
 * Compare to: CreditDisplay.tsx which shows subscription + addon credits.
 */

interface UsageDisplayProps {
  totalActions: number
  includedActions: number
  overageCount: number
  estimatedOverageCharge: number
  dataRefreshedAt?: string
}

export function UsageDisplay({
  totalActions,
  includedActions,
  overageCount,
  estimatedOverageCharge,
  dataRefreshedAt,
}: UsageDisplayProps) {
  const isOverage = overageCount > 0
  const usagePercent = includedActions > 0 ? Math.min(100, (totalActions / includedActions) * 100) : 0

  const formatRefreshTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-1">
      <div className="flex justify-between items-start mb-6">
        <h2 className="section-header">Usage This Cycle</h2>
        {dataRefreshedAt && (
          <span className="font-mono text-[10px] text-charcoal-400">
            Synced {formatRefreshTime(dataRefreshedAt)}
          </span>
        )}
      </div>

      <div className="mb-8">
        <div className="flex items-baseline gap-3">
          <span className="display-number">{totalActions}</span>
          <span className="font-body text-charcoal-400 tracking-wide">
            / {includedActions} included
          </span>
        </div>
        <div className="mt-3 h-2 w-full bg-charcoal-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverage ? 'bg-brass-500' : 'bg-forest-400'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        {isOverage && (
          <div className="mt-2 h-2 w-full bg-charcoal-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-brass-400 transition-all duration-500"
              style={{ width: `${Math.min(100, (overageCount / includedActions) * 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-charcoal-100">
          <span className="font-body text-sm text-charcoal-500">Included (free)</span>
          <span className="font-mono text-sm font-medium text-forest-800">
            {Math.min(totalActions, includedActions)} / {includedActions}
          </span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="font-body text-sm text-charcoal-500">Overage actions</span>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-sm font-medium ${isOverage ? 'text-brass-700' : 'text-forest-800'}`}>
              {overageCount}
            </span>
            {isOverage && (
              <span className="badge badge-brass text-[10px]">billable</span>
            )}
          </div>
        </div>
      </div>

      {isOverage && (
        <div className="mt-6 notice-warning">
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-brass-800">
              Estimated overage charge
            </span>
            <span className="font-mono text-sm font-medium text-brass-800">
              ~${estimatedOverageCharge.toFixed(2)}
            </span>
          </div>
          <p className="mt-1 font-body text-xs text-brass-700">
            Charged at the end of your billing cycle
          </p>
        </div>
      )}

      {!isOverage && totalActions > 0 && (
        <div className="mt-6 notice-success">
          <p className="font-body text-sm text-forest-800">
            All usage within included actions - no overage charge
          </p>
        </div>
      )}
    </div>
  )
}
