/**
 * Native Implementation: History Endpoint
 *
 * Returns local action log entries.
 * Much simpler than credits version - no credit balance tracking.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getNativeActionLog } from '@/lib/native/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const userId = 1 // Single user prototype
    const log = getNativeActionLog(userId, limit)

    return NextResponse.json({
      entries: log.map((entry) => ({
        id: entry.id,
        meterEventId: entry.stripe_meter_event_id,
        createdAt: entry.created_at,
      })),
      count: log.length,
    })
  } catch (error) {
    console.error('[api/native/history] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
