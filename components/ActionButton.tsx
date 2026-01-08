'use client'

import { useState, useCallback } from 'react'

interface ActionButtonProps {
  actionCount: number
  totalCredits: number
  hasActiveSubscription: boolean
  onUseCredit: () => Promise<{ success: boolean; actionCount?: number; error?: string }>
}

export function ActionButton({
  actionCount,
  totalCredits,
  hasActiveSubscription,
  onUseCredit,
}: ActionButtonProps) {
  const [count, setCount] = useState(actionCount)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastClickTime, setLastClickTime] = useState(0)

  const THROTTLE_MS = 500 // Prevent spam clicking

  const handleClick = useCallback(async () => {
    // Client-side throttle
    const now = Date.now()
    if (now - lastClickTime < THROTTLE_MS) {
      return
    }
    setLastClickTime(now)

    setIsLoading(true)
    setError(null)

    try {
      const result = await onUseCredit()

      if (result.success && result.actionCount !== undefined) {
        setCount(result.actionCount)
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }, [lastClickTime, onUseCredit])

  const isDisabled = !hasActiveSubscription || totalCredits === 0 || isLoading

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Perform Action</h2>

      <div className="text-center mb-6">
        <span className="text-gray-500">Total actions performed</span>
        <div className="text-4xl font-bold text-gray-900 mt-1">{count}</div>
      </div>

      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          isDisabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          'Click to Use 1 Credit'
        )}
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
      )}

      {!hasActiveSubscription && (
        <p className="mt-3 text-sm text-gray-500 text-center">
          Subscribe to perform actions
        </p>
      )}

      {hasActiveSubscription && totalCredits === 0 && (
        <p className="mt-3 text-sm text-gray-500 text-center">
          No credits available
        </p>
      )}
    </div>
  )
}
