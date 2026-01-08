/**
 * Native Implementation: Subscription Change (Upgrade/Downgrade)
 *
 * Updates an existing subscription to a different tier by swapping
 * both the license price and usage price on the subscription items.
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getNativeUser, getNativeSubscription, upsertNativeSubscription } from '@/lib/native/db'
import { NATIVE_TIERS, NativeTierName } from '@/lib/native/constants'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { newTier } = body as { newTier: NativeTierName }

    // Validate tier
    if (!newTier || !NATIVE_TIERS[newTier]) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const userId = 1 // Single user prototype
    const user = getNativeUser(userId)
    const subscription = getNativeSubscription(userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
    }

    if (!['active', 'trialing'].includes(subscription.status)) {
      return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 })
    }

    if (subscription.tier === newTier) {
      return NextResponse.json({ error: 'Already on this tier' }, { status: 400 })
    }

    const newTierConfig = NATIVE_TIERS[newTier]

    // Validate price IDs are configured
    if (!newTierConfig.licensePriceId || !newTierConfig.usagePriceId) {
      return NextResponse.json(
        { error: 'Price IDs not configured for target tier' },
        { status: 500 }
      )
    }

    // Get the current Stripe subscription to find item IDs
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    )

    // Find the license and usage items
    let licenseItemId: string | null = null
    let usageItemId: string | null = null

    for (const item of stripeSubscription.items.data) {
      const price = item.price
      // Check if this is a recurring (license) or metered (usage) price
      if (price.recurring?.usage_type === 'metered') {
        usageItemId = item.id
      } else {
        licenseItemId = item.id
      }
    }

    if (!licenseItemId || !usageItemId) {
      return NextResponse.json(
        { error: 'Could not find subscription items' },
        { status: 500 }
      )
    }

    // Update the subscription with new prices
    // Using proration_behavior: 'create_prorations' for fair billing
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        items: [
          {
            id: licenseItemId,
            price: newTierConfig.licensePriceId,
          },
          {
            id: usageItemId,
            price: newTierConfig.usagePriceId,
          },
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          tier: newTier,
          changed_at: new Date().toISOString(),
        },
      }
    )

    // Update local database
    upsertNativeSubscription(userId, {
      tier: newTier,
      status: updatedSubscription.status as 'active' | 'trialing',
    })

    const isUpgrade = NATIVE_TIERS[newTier].licenseFee > NATIVE_TIERS[subscription.tier].licenseFee

    return NextResponse.json({
      success: true,
      newTier,
      isUpgrade,
      message: `Successfully ${isUpgrade ? 'upgraded' : 'downgraded'} to ${newTierConfig.name}`,
    })
  } catch (error) {
    console.error('[api/native/subscription/change] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
