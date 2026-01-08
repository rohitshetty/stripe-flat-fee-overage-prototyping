# Implementing a Credit-Based Subscription System with Stripe

I spent some time building a prototype for a credit-based subscription system that integrates with Stripe. The goal was to figure out exactly where the line is between "things Stripe handles" and "things you have to build yourself."

The short answer: Stripe handles billing, you handle credits. But the details are interesting.

## The Setup

The system has three subscription tiers:

| Tier | Price | Credits/month |
|------|-------|---------------|
| Starter | $10 | 1 |
| Expert | $15 | 5 |
| Pro | $20 | 10 |

Plus one-time add-on packs (3 credits for $25, 10 for $70, 25 for $150).

The key business rules:
- Subscription credits expire at the end of each billing cycle
- Add-on credits never expire
- When consuming credits, use subscription credits first (since they expire)
- Upgrades grant the credit difference immediately
- Downgrades take effect at next renewal

None of this is something Stripe knows about.

## The Database Schema

I'm using SQLite with raw SQL (no ORM). The schema lives in [`scripts/init-db.ts`](../scripts/init-db.ts):

```sql
CREATE TABLE credits (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    subscription_credits INTEGER DEFAULT 0,
    addon_credits INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE credit_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    credits_change INTEGER,
    credit_type TEXT,
    balance_before INTEGER,
    balance_after INTEGER,
    description TEXT,
    stripe_event_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

The separation of `subscription_credits` and `addon_credits` is important—they have different lifecycles and we need to track them independently.

The `credit_log` table is an append-only audit log. Every credit operation gets recorded here with before/after balances. This has been invaluable for debugging.

## The Webhook Handler

The webhook handler at [`app/api/webhooks/stripe/route.ts`](../app/api/webhooks/stripe/route.ts) is where Stripe events get translated into credit operations.

Here's the structure:

```typescript
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(body, signature, WEBHOOK_SECRET)
  } catch (error) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency check
  if (hasProcessedStripeEvent(event.id)) {
    return NextResponse.json({ received: true, skipped: true })
  }

  switch (event.type) {
    case 'customer.subscription.created':
      // Handle new subscription
      break
    case 'customer.subscription.updated':
      // Handle upgrades, downgrades, cancellation scheduling
      break
    case 'customer.subscription.deleted':
      // Handle actual cancellation (expire credits)
      break
    case 'invoice.paid':
      // Handle renewals (allocate fresh credits)
      break
    case 'invoice.payment_failed':
      // Handle failed payments (set grace period)
      break
  }

  return NextResponse.json({ received: true })
}
```

The idempotency check is critical. Stripe guarantees at-least-once delivery, so the same event can arrive multiple times. We track processed events by storing the `stripe_event_id` in our `credit_log` table:

```typescript
export function hasProcessedStripeEvent(stripeEventId: string): boolean {
  const result = getDb()
    .prepare('SELECT 1 FROM credit_log WHERE stripe_event_id = ? LIMIT 1')
    .get(stripeEventId)
  return !!result
}
```

## Translating Price IDs to Tiers

Stripe knows about price IDs like `price_abc123`. Our application knows about tiers like `expert`. The mapping is in [`lib/constants.ts`](../lib/constants.ts):

```typescript
export const TIERS = {
  starter: {
    name: 'Starter',
    price: 1000,
    credits: 1,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
  },
  expert: {
    name: 'Expert',
    price: 1500,
    credits: 5,
    priceId: process.env.STRIPE_EXPERT_PRICE_ID || '',
  },
  pro: {
    name: 'Pro',
    price: 2000,
    credits: 10,
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
  },
} as const

export function getTierFromPriceId(priceId: string): TierName | null {
  for (const [tier, config] of Object.entries(TIERS)) {
    if (config.priceId === priceId) {
      return tier as TierName
    }
  }
  return null
}

export function getTierCredits(tier: TierName): number {
  return TIERS[tier]?.credits ?? 0
}
```

When a webhook arrives, we extract the price ID from the Stripe subscription object and look up our tier:

```typescript
case 'customer.subscription.created': {
  const subscription = event.data.object as Stripe.Subscription
  const priceId = subscription.items.data[0]?.price?.id
  const tier = priceId ? getTierFromPriceId(priceId) : null

  if (tier) {
    handleSubscriptionCreated(userId, { tier, ... }, event.id)
  }
  break
}
```

## Credit Consumption

The credit consumption logic is in [`lib/credits.ts`](../lib/credits.ts). The `useCredit()` function is called when a user clicks the action button:

```typescript
export function useCredit(userId: number = 1): UseCreditsResult {
  return transaction(() => {
    // 1. Check subscription status
    const subscription = getSubscription(userId)
    if (!subscription || !canUseCredits(subscription.status)) {
      return { success: false, error: 'No active subscription' }
    }

    // 2. Get current credits
    const credits = getCredits(userId)
    const { subscription_credits, addon_credits } = credits

    // 3. Determine which credit type to use (subscription first)
    let newSubscriptionCredits = subscription_credits
    let newAddonCredits = addon_credits
    let creditType: 'subscription' | 'addon'

    if (subscription_credits > 0) {
      newSubscriptionCredits -= 1
      creditType = 'subscription'
    } else if (addon_credits > 0) {
      newAddonCredits -= 1
      creditType = 'addon'
    } else {
      return { success: false, error: 'No credits available' }
    }

    // 4. Update and log
    updateCredits(userId, newSubscriptionCredits, newAddonCredits)
    incrementActionCount(userId)
    logCreditEvent(userId, 'usage', { ... })

    return { success: true, balance: { ... } }
  })
}
```

The `transaction()` wrapper ensures atomicity. This is important because two simultaneous requests could otherwise both read the same balance and both succeed, effectively double-spending a credit.

The `canUseCredits()` check is also important:

```typescript
export const USABLE_STATUSES = ['trialing', 'active', 'past_due'] as const

export function canUseCredits(status: string): boolean {
  return USABLE_STATUSES.includes(status as UsableStatus)
}
```

A user in `past_due` status (payment failed, within grace period) can still use remaining credits. But a `canceled` user cannot—even if they have add-on credits in their balance.

## Credit Allocation on Renewal

When `invoice.paid` arrives for a subscription renewal, we need to:
1. Expire any remaining subscription credits
2. Allocate fresh credits for the new cycle

This happens in [`lib/credits.ts`](../lib/credits.ts):

```typescript
export function allocateSubscriptionCredits(
  userId: number,
  tier: TierName,
  stripeEventId?: string
): void {
  transaction(() => {
    const credits = getCredits(userId)
    const currentSubCredits = credits.subscription_credits
    const currentAddonCredits = credits.addon_credits

    // Expire remaining subscription credits
    if (currentSubCredits > 0) {
      logCreditEvent(userId, 'credits_expired', {
        creditsChange: -currentSubCredits,
        creditType: 'subscription',
        balanceBefore: currentSubCredits + currentAddonCredits,
        balanceAfter: currentAddonCredits,
        description: 'Subscription credits expired at cycle end',
        stripeEventId,
      })
    }

    // Allocate new credits
    const newCredits = getTierCredits(tier)
    updateCredits(userId, newCredits, currentAddonCredits)

    logCreditEvent(userId, 'subscription_renewal', {
      creditsChange: newCredits,
      creditType: 'subscription',
      balanceBefore: currentAddonCredits,
      balanceAfter: newCredits + currentAddonCredits,
      description: `Allocated ${newCredits} credits for ${tier} tier`,
      stripeEventId,
    })
  })
}
```

Note how we log the expiration as a separate event. This creates a clear audit trail:

```
[2025-01-08 10:00:00] credits_expired: -2 (5 → 3)
[2025-01-08 10:00:00] subscription_renewal: +5 (3 → 8)
```

## The Cancellation Flow

Cancellation is a two-phase process in Stripe:

**Phase 1:** User clicks "Cancel" in Customer Portal. Stripe sets `cancel_at_period_end: true` and sends `subscription.updated`. We record this flag:

```typescript
case 'customer.subscription.updated': {
  const subscription = event.data.object as Stripe.Subscription
  handleSubscriptionUpdated(userId, {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    // ... other fields
  }, event.id)
  break
}
```

The user keeps their credits and access until the period ends. We show a banner in the UI.

**Phase 2:** Period ends. Stripe sends `subscription.deleted`. Now we actually expire the credits:

```typescript
export function handleSubscriptionDeleted(
  userId: number,
  stripeSubscriptionId: string,
  stripeEventId?: string
): void {
  expireSubscriptionCredits(userId, stripeEventId, 'Subscription canceled')

  upsertSubscription(userId, {
    status: 'canceled',
    cancel_at_period_end: false,
  })
}
```

The `expireSubscriptionCredits()` function sets subscription credits to 0 and logs the expiration. Add-on credits remain untouched—they just become unusable since the subscription status is now `canceled`.

## What Stripe Handles

Here's what we delegate entirely to Stripe:

**Checkout:** We create a session and redirect. Stripe handles card input, validation, 3D Secure, etc.

```typescript
export async function createSubscriptionCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  trialDays?: number
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: trialDays ? { trial_period_days: trialDays } : undefined,
  })
}
```

**Customer Portal:** For subscription management, we just generate a portal URL:

```typescript
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}
```

Users can update payment methods, change plans, cancel, and view invoices—all without us building any UI.

**Payment retries:** When a payment fails, Stripe automatically retries with smart timing. We just listen for the events and update our status accordingly.

## SQLite Gotcha: Booleans

Ran into an issue where webhook processing was failing with:

```
TypeError: SQLite3 can only bind numbers, strings, bigints, buffers, and null
```

The problem was in [`lib/db.ts`](../lib/db.ts). The `cancel_at_period_end` field from Stripe is a boolean, but SQLite doesn't have a boolean type. Fixed it by converting booleans to integers:

```typescript
export function upsertSubscription(
  userId: number,
  data: Partial<Omit<Subscription, 'id' | 'user_id' | 'created_at'>>
) {
  // Convert booleans to integers for SQLite
  const sqlData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    sqlData[key] = typeof value === 'boolean' ? (value ? 1 : 0) : value
  }
  // ... rest of function uses sqlData instead of data
}
```

## Lazy Stripe Client Initialization

Another issue: the Next.js build was failing because `STRIPE_SECRET_KEY` wasn't available at build time. The fix was lazy initialization in [`lib/stripe.ts`](../lib/stripe.ts):

```typescript
let stripeInstance: Stripe | null = null

function getStripeClient(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    })
  }
  return stripeInstance
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return getStripeClient()[prop as keyof Stripe]
  },
})
```

The Proxy ensures the client is only instantiated when actually used, not at module load time.

## Testing with the CLI

I built a CLI tool for testing scenarios without going through Stripe. It's at [`cli/index.ts`](../cli/index.ts):

```bash
# Check current state
npm run cli status

# Set up a scenario
npm run cli set-subscription pro active  # Sets tier and allocates credits
npm run cli set-credits 5 10             # 5 subscription, 10 addon
npm run cli add-addon-credits 25

# View history
npm run cli list-events

# Reset everything
npm run cli reset
```

This made it much easier to test edge cases like "what happens when subscription credits are 0 but addon credits remain" without having to create actual Stripe subscriptions.

## Things I'd Do Differently in Production

**PostgreSQL instead of SQLite.** SQLite is great for prototyping but PostgreSQL would be better for concurrency and operational tooling.

**User authentication.** The prototype hardcodes `userId = 1`. Real applications need auth and multi-tenancy.

**Webhook retry handling.** If our webhook handler fails, we return a 500 and Stripe retries. But we should also have our own mechanism to detect and recover from missed webhooks—maybe a periodic job that reconciles with Stripe's API.

**Real-time Stripe checks.** When a user tries to act and we think they have 0 credits, but it's right around their renewal time, the webhook might just be delayed. A production system might check Stripe's API directly in these edge cases.

**Monitoring.** Alerts for webhook processing failures, credit balance discrepancies, and unusual patterns.

## The Key Insight

Stripe is a billing system. It knows about money—payments, subscriptions, invoices. It doesn't know about entitlements—what a payment means for what a user can do.

The webhook is the translation layer. Stripe says "this invoice was paid." You translate that to "this user now has 5 credits." Stripe says "this subscription was deleted." You translate that to "expire remaining credits."

The implementation is straightforward once you accept this division of responsibility. A few hundred lines of code for the credit logic, a switch statement in the webhook handler, and you're done. The complexity is in understanding where the boundaries are.
