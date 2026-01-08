import { NextRequest, NextResponse } from 'next/server'
import { getCreditLog } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const userId = 1 // Single user prototype

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const log = getCreditLog(userId, Math.min(limit, 100))

    const entries = log.map(entry => ({
      id: entry.id,
      eventType: entry.event_type,
      creditsChange: entry.credits_change,
      creditType: entry.credit_type,
      balanceBefore: entry.balance_before,
      balanceAfter: entry.balance_after,
      description: entry.description,
      createdAt: entry.created_at,
    }))

    return NextResponse.json({
      entries,
      count: entries.length,
    })
  } catch (error) {
    console.error('Error fetching history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
