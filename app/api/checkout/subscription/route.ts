import { NextRequest, NextResponse } from 'next/server'
import { getUser, updateUserStripeCustomerId } from '@/lib/db'
import { getOrCreateCustomer, createSubscriptionCheckoutSession } from '@/lib/stripe'
import { TIERS, TierName, TRIAL_DAYS } from '@/lib/constants'
import { getSubscriptionInfo } from '@/lib/subscriptions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tier, includeTrial } = body as { tier: TierName; includeTrial?: boolean }

    if (!tier || !TIERS[tier]) {
      return NextResponse.json(
        { error: 'Invalid tier' },
        { status: 400 }
      )
    }

    const userId = 1 // Single user prototype
    const user = getUser(userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if already has active subscription
    const subscription = getSubscriptionInfo(userId)
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return NextResponse.json(
        { error: 'Already have an active subscription. Use Customer Portal to change plans.' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id
    if (!customerId) {
      customerId = await getOrCreateCustomer(user.email)
      updateUserStripeCustomerId(userId, customerId)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const priceId = TIERS[tier].priceId

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID not configured for this tier' },
        { status: 500 }
      )
    }

    // Create checkout session
    const session = await createSubscriptionCheckoutSession(
      customerId,
      priceId,
      `${appUrl}?checkout=success`,
      `${appUrl}?checkout=canceled`,
      includeTrial ? TRIAL_DAYS : undefined
    )

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
