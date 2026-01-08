'use client'

/**
 * Native Implementation: History Page
 *
 * Simple action log - no credit balance tracking.
 * Compare to: app/history/page.tsx (detailed credit events)
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface ActionLogEntry {
  id: number
  meterEventId: string | null
  createdAt: string
}

export default function NativeHistoryPage() {
  const [entries, setEntries] = useState<ActionLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/native/history?limit=100')
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-forest-200 border-t-forest-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 opacity-0 animate-fade-in">
        <div>
          <h1 className="font-display text-4xl font-semibold text-forest-800 tracking-tight">
            Action History
          </h1>
          <p className="font-body text-charcoal-500 mt-1">
            Local action log - Stripe tracks billing details
          </p>
        </div>
        <Link href="/native" className="btn-ghost group flex items-center gap-2">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span>Back to Dashboard</span>
        </Link>
      </header>

      {/* Info Banner */}
      <div className="card-ledger p-6 mb-8 opacity-0 animate-slide-up">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-brass-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-body text-sm text-charcoal-700">
              <strong>Stripe handles billing details.</strong> This log is for local UI tracking only.
              For detailed invoices and usage breakdowns, visit the Stripe Customer Portal.
            </p>
          </div>
        </div>
      </div>

      {/* Action Log */}
      <div className="card-ledger p-6 opacity-0 animate-slide-up stagger-1">
        <h2 className="section-header mb-6">Recent Actions</h2>

        {entries.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-4 text-charcoal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="font-body text-charcoal-400">No actions recorded yet</p>
            <p className="font-body text-sm text-charcoal-300 mt-1">
              Perform actions from the dashboard to see them here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className="flex justify-between items-center py-3 border-b border-charcoal-100 last:border-0"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-forest-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-forest-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-body text-sm text-charcoal-700">Action performed</p>
                    {entry.meterEventId && (
                      <p className="font-mono text-xs text-charcoal-400 truncate max-w-[200px]">
                        {entry.meterEventId}
                      </p>
                    )}
                  </div>
                </div>
                <span className="font-mono text-xs text-charcoal-400">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparison Note */}
      <div className="mt-8 p-4 bg-ivory-100 rounded-lg opacity-0 animate-fade-in stagger-2">
        <p className="font-body text-xs text-charcoal-500 text-center">
          <strong>Simplicity note:</strong> This page has no credit balance tracking.
          Compare to the{' '}
          <Link href="/history" className="text-forest-600 hover:underline">
            credits history page
          </Link>{' '}
          which tracks balance changes, credit types, and expiration events.
        </p>
      </div>
    </div>
  )
}
