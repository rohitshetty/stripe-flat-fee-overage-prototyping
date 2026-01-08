/**
 * Native Implementation: Webhook Handler
 *
 * SIMPLICITY: ~70 lines vs ~187 lines in api/webhooks/stripe/route.ts
 *
 * This webhook handler ONLY updates local subscription status.
 * No credit allocation, expiration, or sync logic needed.
 *
 * Compare to credits version which must:
 * - Track idempotency for credit operations
 * - Allocate credits on subscription creation
 * - Handle addon credit purchases
 * - Expire credits on renewal (before allocating new ones)
 * - Calculate upgrade credit differences
 * - Expire credits on cancellation
 * - Update subscription + credits atomically
 *
 * Native version: Stripe handles all usage tracking and billing.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { constructWebhookEvent } from '@/lib/stripe'
import {
  getNativeUser,
  updateNativeUserStripeCustomerId,
  upsertNativeSubscription,
} from '@/lib/native/db'
import { getNativeTierFromPriceId } from '@/lib/native/constants'

const WEBHOOK_SECRET = process.env.STRIPE_NATIVE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('[native/webhook] STRIPE_NATIVE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = constructWebhookEvent(body, signature, WEBHOOK_SECRET)
  } catch (error) {
    console.error('[native/webhook] Signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[native/webhook] Processing: ${event.type} (${event.id})`)

  const userId = 1 // Single user prototype

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Update customer ID if needed
        if (session.customer && typeof session.customer === 'string') {
          const user = getNativeUser(userId)
          if (user && !user.stripe_customer_id) {
            updateNativeUserStripeCustomerId(userId, session.customer)
          }
        }
        // NOTE: No addon handling - native implementation uses overages instead
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        // Find the license price to determine tier (first non-metered price)
        let tier = null
        for (const item of subscription.items.data) {
          const priceId = item.price?.id
          if (priceId) {
            tier = getNativeTierFromPriceId(priceId)
            if (tier) break
          }
        }

        if (tier) {
          upsertNativeSubscription(userId, {
            stripe_subscription_id: subscription.id,
            tier,
            status: mapStripeStatus(subscription.status),
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
        }
        // NOTE: No credit allocation - Stripe Meters track usage automatically
        break
      }

      case 'customer.subscription.deleted': {
        upsertNativeSubscription(userId, { status: 'canceled' })
        // NOTE: No credit expiration - Stripe handles usage billing
        break
      }

      case 'invoice.paid': {
        // NOTE: No credit renewal logic needed!
        // Stripe Meters automatically reset usage tracking per billing period.
        // We just update period dates if subscription info is available.
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription && typeof invoice.subscription === 'string') {
          // Period dates are updated via subscription.updated webhook
          console.log(`[native/webhook] Invoice paid for subscription: ${invoice.subscription}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          upsertNativeSubscription(userId, { status: 'past_due' })
        }
        break
      }

      default:
        console.log(`[native/webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`[native/webhook] Error processing ${event.type}:`, error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// Map Stripe subscription status to our status
function mapStripeStatus(
  status: Stripe.Subscription.Status
): 'trialing' | 'active' | 'past_due' | 'canceled' {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'canceled'
    default:
      return 'active'
  }
}
