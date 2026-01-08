'use client'

interface CreditDisplayProps {
  subscriptionCredits: number
  addonCredits: number
  totalCredits: number
}

export function CreditDisplay({
  subscriptionCredits,
  addonCredits,
  totalCredits,
}: CreditDisplayProps) {
  return (
    <div className="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-1">
      <h2 className="section-header mb-6">Credit Balance</h2>

      <div className="mb-8">
        <div className="flex items-baseline gap-3">
          <span className="display-number">{totalCredits}</span>
          <span className="font-body text-charcoal-400 tracking-wide">credits available</span>
        </div>
        <div className="mt-2 h-1 w-24 bg-gradient-to-r from-brass-400 to-brass-200 rounded-full" />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-charcoal-100">
          <span className="font-body text-sm text-charcoal-500">Subscription</span>
          <span className="font-mono text-sm font-medium text-forest-800">{subscriptionCredits}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="font-body text-sm text-charcoal-500">Add-on</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-forest-800">{addonCredits}</span>
            {addonCredits > 0 && (
              <span className="badge badge-brass text-[10px]">permanent</span>
            )}
          </div>
        </div>
      </div>

      {totalCredits <= 2 && totalCredits > 0 && (
        <div className="mt-6 notice-warning">
          <p className="font-body text-sm text-brass-800">
            Running low on credits. Consider purchasing an add-on pack.
          </p>
        </div>
      )}

      {totalCredits === 0 && (
        <div className="mt-6 notice-danger">
          <p className="font-body text-sm text-burgundy-800">
            No credits remaining. Purchase add-ons to continue.
          </p>
        </div>
      )}
    </div>
  )
}
