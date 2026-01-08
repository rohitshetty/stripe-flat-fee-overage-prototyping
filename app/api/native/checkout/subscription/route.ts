/**
 * Native Implementation: Checkout Endpoint
 *
 * KEY DIFFERENCE: Creates subscription with TWO line items:
 * 1. License fee (flat recurring)
 * 2. Usage price (metered)
 *
 * Compare to credits version which has single price per tier.
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe, getOrCreateCustomer } from '@/lib/stripe'
import {
  getNativeUser,
  updateNativeUserStripeCustomerId,
  getNativeSubscription,
} from '@/lib/native/db'
import { NATIVE_TIERS, NativeTierName, TRIAL_DAYS } from '@/lib/native/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tier, includeTrial } = body as { tier: NativeTierName; includeTrial?: boolean }

    // Validate tier
    if (!tier || !NATIVE_TIERS[tier]) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const userId = 1 // Single user prototype
    const user = getNativeUser(userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check for existing active subscription
    const subscription = getNativeSubscription(userId)
    if (subscription && ['active', 'trialing'].includes(subscription.status)) {
      return NextResponse.json(
        { error: 'Already have an active subscription' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id
    if (!customerId) {
      customerId = await getOrCreateCustomer(user.email)
      updateNativeUserStripeCustomerId(userId, customerId)
    }

    const tierConfig = NATIVE_TIERS[tier]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Validate price IDs
    if (!tierConfig.licensePriceId || !tierConfig.usagePriceId) {
      return NextResponse.json(
        { error: 'Price IDs not configured for this tier' },
        { status: 500 }
      )
    }

    // Create checkout session with TWO line items (license + metered usage)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        // License fee (flat monthly charge)
        {
          price: tierConfig.licensePriceId,
          quantity: 1,
        },
        // Usage price (metered - no quantity, billed based on meter events)
        {
          price: tierConfig.usagePriceId,
        },
      ],
      success_url: `${appUrl}/native?checkout=success`,
      cancel_url: `${appUrl}/native?checkout=canceled`,
      subscription_data: includeTrial
        ? { trial_period_days: TRIAL_DAYS }
        : undefined,
      metadata: {
        prototype: 'true',
        implementation: 'native',
        tier,
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('[api/native/checkout/subscription] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
