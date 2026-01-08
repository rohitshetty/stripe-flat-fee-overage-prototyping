'use client'

interface GracePeriodBannerProps {
  gracePeriodEndsAt: string
  onUpdatePayment: () => void
}

export function GracePeriodBanner({
  gracePeriodEndsAt,
  onUpdatePayment,
}: GracePeriodBannerProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="bg-burgundy-700 text-ivory-100 px-4 py-4 animate-slide-up">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-burgundy-600 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="font-body text-sm font-medium">Payment failed</p>
            <p className="font-body text-xs text-burgundy-200">
              Update by {formatDate(gracePeriodEndsAt)} to continue service
            </p>
          </div>
        </div>
        <button
          onClick={onUpdatePayment}
          className="px-4 py-2 bg-ivory-100 text-burgundy-800 font-body text-sm font-medium hover:bg-ivory-200 transition-colors shadow-emboss"
        >
          Update Payment
        </button>
      </div>
    </div>
  )
}
