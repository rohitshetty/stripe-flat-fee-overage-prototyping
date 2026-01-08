import { NextRequest, NextResponse } from 'next/server'
import { getUser, updateUserStripeCustomerId } from '@/lib/db'
import { getOrCreateCustomer, createAddonCheckoutSession } from '@/lib/stripe'
import { ADDONS, AddonName } from '@/lib/constants'
import { canPurchaseAddons } from '@/lib/subscriptions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pack } = body as { pack: AddonName }

    if (!pack || !ADDONS[pack]) {
      return NextResponse.json(
        { error: 'Invalid addon pack' },
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

    // Check if can purchase addons
    if (!canPurchaseAddons(userId)) {
      return NextResponse.json(
        { error: 'Must have an active subscription to purchase add-ons' },
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
    const priceId = ADDONS[pack].priceId

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID not configured for this addon' },
        { status: 500 }
      )
    }

    // Create checkout session
    const session = await createAddonCheckoutSession(
      customerId,
      priceId,
      `${appUrl}?addon=success`,
      `${appUrl}?addon=canceled`
    )

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Error creating addon checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
