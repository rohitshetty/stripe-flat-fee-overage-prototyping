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

  const THROTTLE_MS = 500

  const handleClick = useCallback(async () => {
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
    <div className="card-ledger corner-flourish p-6 opacity-0 animate-slide-up stagger-2">
      <h2 className="section-header mb-6">Actions</h2>

      <div className="mb-8">
        <div className="flex items-baseline gap-3">
          <span className="display-number">{count}</span>
          <span className="font-body text-charcoal-400 tracking-wide">performed</span>
        </div>
        <div className="mt-2 h-1 w-24 bg-gradient-to-r from-forest-400 to-forest-200 rounded-full" />
      </div>

      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`btn-primary w-full flex items-center justify-center gap-2 ${
          isDisabled ? '' : 'animate-glow'
        }`}
      >
        {isLoading ? (
          <>
            <svg className="spinner h-4 w-4" viewBox="0 0 24 24">
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
            <span>Processing...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Use 1 Credit</span>
          </>
        )}
      </button>

      {error && (
        <div className="mt-4 notice-danger">
          <p className="font-body text-sm text-burgundy-700">{error}</p>
        </div>
      )}

      {!hasActiveSubscription && (
        <p className="mt-4 font-body text-sm text-charcoal-400 text-center">
          Subscribe to perform actions
        </p>
      )}
    </div>
  )
}
