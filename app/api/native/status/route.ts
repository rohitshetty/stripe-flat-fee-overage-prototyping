/**
 * Native Implementation: Status Endpoint
 *
 * Returns user info, subscription status, and current usage from Stripe.
 */

import { NextResponse } from 'next/server'
import {
  getNativeUser,
  getNativeSubscription,
  getNativeActionCount,
} from '@/lib/native/db'
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Default usage values
    let usage = {
      totalActions: 0,
      includedActions: 0,
      overageCount: 0,
      estimatedOverageCharge: 0,
    }

    // Get current usage from Stripe meter if we have the required data
    if (
      user.stripe_customer_id &&
      subscription?.current_period_start &&
      subscription?.current_period_end
    ) {
      const tier = subscription.tier as NativeTierName
      const { totalActions } = await getCurrentUsage(
        user.stripe_customer_id,
        new Date(subscription.current_period_start),
        new Date(subscription.current_period_end)
      )

      const includedActions = getNativeTierIncludedActions(tier)
      const overageCount = Math.max(0, totalActions - includedActions)
      const overageRate = getNativeTierOverageRate(tier)

      usage = {
        totalActions,
        includedActions,
        overageCount,
        estimatedOverageCharge: (overageCount * overageRate) / 100, // Convert cents to dollars
      }
    }

    // Get local action count for display
    const localActionCount = getNativeActionCount(userId)

    // Calculate days until renewal
    let daysUntilRenewal: number | null = null
    if (subscription?.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end)
      const now = new Date()
      const diffMs = periodEnd.getTime() - now.getTime()
      daysUntilRenewal = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        stripeCustomerId: user.stripe_customer_id,
      },
      subscription: {
        tier: subscription?.tier || 'starter',
        status: subscription?.status || 'none',
        currentPeriodStart: subscription?.current_period_start || null,
        currentPeriodEnd: subscription?.current_period_end || null,
        daysUntilRenewal,
      },
      usage,
      localActionCount,
      dataRefreshedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[api/native/status] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
