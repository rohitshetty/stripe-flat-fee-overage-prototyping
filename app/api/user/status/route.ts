import { NextResponse } from 'next/server'
import { getUser, getActions } from '@/lib/db'
import { getCreditBalance } from '@/lib/credits'
import { getSubscriptionInfo } from '@/lib/subscriptions'

export async function GET() {
  try {
    const userId = 1 // Single user prototype

    const user = getUser(userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const credits = getCreditBalance(userId)
    const subscription = getSubscriptionInfo(userId)
    const actions = getActions(userId)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        stripeCustomerId: user.stripe_customer_id,
      },
      credits: {
        subscription: credits.subscriptionCredits,
        addon: credits.addonCredits,
        total: credits.totalCredits,
      },
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        daysUntilRenewal: subscription.daysUntilRenewal,
        isInGracePeriod: subscription.isInGracePeriod,
        gracePeriodEndsAt: subscription.gracePeriodEndsAt?.toISOString() ?? null,
        trialEnd: subscription.trialEnd?.toISOString() ?? null,
      },
      actionCount: actions?.total_count ?? 0,
    })
  } catch (error) {
    console.error('Error fetching user status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
