/**
 * Native Implementation: Usage Endpoint
 *
 * Queries current billing period usage directly from Stripe meter.
 */

import { NextResponse } from 'next/server'
import { getNativeUser, getNativeSubscription } from '@/lib/native/db'
import { getCurrentUsage } from '@/lib/native/meter'
import {
  getNativeTierIncludedActions,
  getNativeTierOverageRate,
  NativeTierName,
} from '@/lib/native/constants'

export async function GET() {
  try {
    const userId = 1 // Single user prototype
    const user = getNativeUser(userId)
    const subscription = getNativeSubscription(userId)

    if (!user?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer configured' },
        { status: 400 }
      )
    }

    if (!subscription?.current_period_start || !subscription?.current_period_end) {
      return NextResponse.json(
        { error: 'No active billing period' },
        { status: 400 }
      )
    }

    // Query Stripe meter for current period usage
    const { totalActions, error } = await getCurrentUsage(
      user.stripe_customer_id,
      new Date(subscription.current_period_start),
      new Date(subscription.current_period_end)
    )

    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    const tier = subscription.tier as NativeTierName
    const includedActions = getNativeTierIncludedActions(tier)
    const overageRate = getNativeTierOverageRate(tier)
    const overageCount = Math.max(0, totalActions - includedActions)

    return NextResponse.json({
      totalActions,
      includedActions,
      overageCount,
      estimatedOverageCharge: (overageCount * overageRate) / 100, // Convert cents to dollars
      tier: subscription.tier,
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
    })
  } catch (error) {
    console.error('[api/native/usage] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
