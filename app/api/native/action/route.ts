/**
 * Native Implementation: Action Endpoint
 *
 * SIMPLICITY: ~25 lines vs ~80 lines in api/credits/use/route.ts
 *
 * This endpoint:
 * 1. Checks subscription status
 * 2. Sends ONE meter event to Stripe
 * 3. Logs locally for UI (optional)
 *
 * Compare to credits version which does:
 * - Transaction lock
 * - Credit balance check
 * - Credit type priority (subscription vs addon)
 * - Balance decrement
 * - Action counter increment
 * - Audit logging
 */

import { NextResponse } from 'next/server'
import { getNativeUser, getNativeSubscription, logNativeAction } from '@/lib/native/db'
import { recordAction } from '@/lib/native/meter'
import { canPerformActions } from '@/lib/native/constants'

export async function POST() {
  try {
    const userId = 1 // Single user prototype
    const user = getNativeUser(userId)
    const subscription = getNativeSubscription(userId)

    if (!user?.stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer configured' }, { status: 400 })
    }

    if (!subscription || !canPerformActions(subscription.status)) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    // THE KEY SIMPLICITY: One API call to Stripe
    const result = await recordAction(user.stripe_customer_id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Optional: Log locally for UI responsiveness
    logNativeAction(userId, result.meterEventId)

    return NextResponse.json({
      success: true,
      meterEventId: result.meterEventId,
    })
  } catch (error) {
    console.error('[api/native/action] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
