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
      year: 'numeric',
    })
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <svg
            className="h-5 w-5 text-amber-500 mr-3"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <span className="text-sm font-medium text-amber-800">
              Payment failed.
            </span>
            <span className="text-sm text-amber-700 ml-1">
              Update your payment method before {formatDate(gracePeriodEndsAt)} to continue service.
            </span>
          </div>
        </div>
        <button
          onClick={onUpdatePayment}
          className="ml-4 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
        >
          Update Payment
        </button>
      </div>
    </div>
  )
}
