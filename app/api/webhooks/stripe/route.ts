import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { constructWebhookEvent, stripe } from '@/lib/stripe'
import { getUser, updateUserStripeCustomerId, hasProcessedStripeEvent } from '@/lib/db'
import { getTierFromPriceId, getAddonCredits, TierName } from '@/lib/constants'
import { addAddonCredits } from '@/lib/credits'
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handlePaymentFailed,
} from '@/lib/subscriptions'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = constructWebhookEvent(body, signature, WEBHOOK_SECRET)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Idempotency check
  if (hasProcessedStripeEvent(event.id)) {
    console.log(`Skipping already processed event: ${event.id}`)
    return NextResponse.json({ received: true, skipped: true })
  }

  console.log(`Processing webhook: ${event.type} (${event.id})`)

  const userId = 1 // Single user prototype

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Update customer ID if needed
        if (session.customer && typeof session.customer === 'string') {
          const user = getUser(userId)
          if (user && !user.stripe_customer_id) {
            updateUserStripeCustomerId(userId, session.customer)
          }
        }

        // Handle addon purchase
        if (session.mode === 'payment' && session.metadata?.addon === 'true') {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
          for (const item of lineItems.data) {
            if (item.price?.id) {
              const credits = getAddonCredits(item.price.id)
              if (credits > 0) {
                addAddonCredits(userId, credits, event.id, `Addon pack purchased: ${item.description}`)
              }
            }
          }
        }
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price?.id
        const tier = priceId ? getTierFromPriceId(priceId) : null

        if (tier) {
          handleSubscriptionCreated(userId, {
            stripeSubscriptionId: subscription.id,
            tier,
            status: mapStripeStatus(subscription.status),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          }, event.id)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price?.id
        const tier = priceId ? getTierFromPriceId(priceId) : null

        if (tier) {
          handleSubscriptionUpdated(userId, {
            stripeSubscriptionId: subscription.id,
            tier,
            status: mapStripeStatus(subscription.status),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
          }, event.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        handleSubscriptionDeleted(userId, subscription.id, event.id)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice

        // Only process subscription renewals (not initial creation)
        if (invoice.billing_reason === 'subscription_cycle') {
          const subscriptionId = invoice.subscription as string
          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            const priceId = subscription.items.data[0]?.price?.id
            const tier = priceId ? getTierFromPriceId(priceId) : null

            if (tier) {
              handleInvoicePaid(userId, tier, event.id)
            }
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          handlePaymentFailed(userId, event.id)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Map Stripe subscription status to our status
function mapStripeStatus(status: Stripe.Subscription.Status): 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'unpaid':
      return 'unpaid'
    default:
      return 'active'
  }
}
