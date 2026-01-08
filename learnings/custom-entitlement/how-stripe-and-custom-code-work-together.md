# The Dance Between Stripe and Your Application

When you build a subscription product, you quickly discover an uncomfortable truth: Stripe is incredibly good at what it does, but what it does isn't everything you need.

Stripe will collect payments, retry failed charges, generate invoices, and manage subscription lifecycles with remarkable sophistication. But it won't track how many "actions" a user has left. It won't block someone who's exhausted their monthly allocation. It won't understand that subscription credits expire but add-on credits don't.

This prototype exists to explore that boundary—to find where Stripe ends and your application begins, and to build a bridge between the two that doesn't leak.

---

## The Shape of the Problem

The credit model here is deceptively simple on the surface. Users subscribe to a tier (Starter, Expert, or Pro), each granting a fixed number of monthly credits. They can also purchase add-on packs for extra credits. Every time they click a button, one credit is consumed.

But the rules beneath this simplicity create real complexity:

1. **Subscription credits expire** at the end of each billing cycle. If you don't use them, you lose them.
2. **Add-on credits never expire.** They persist until consumed.
3. **Subscription credits are consumed first** because they expire—using add-ons first would waste money.
4. **Upgrades grant the difference immediately.** Go from Starter (1 credit) to Pro (10 credits) mid-cycle, and you get 9 credits right now.
5. **Downgrades take effect at renewal.** You keep your current credits until the cycle ends.
6. **Cancellation is a two-phase process.** First the user initiates it, then the period ends and credits actually expire.

Stripe has no concept of any of this. To Stripe, a subscription is a subscription. It knows billing cycles and payment status, but "credits" are a foreign concept. The translation from "this invoice was paid" to "this user now has 5 credits" must happen somewhere—and that somewhere is your code.

---

## The Architecture That Emerged

The system splits cleanly into three layers, each with a distinct responsibility.

**Stripe handles money.** Checkout sessions, payment collection, subscription management, invoices, the Customer Portal. When a user wants to subscribe or manage their billing, they interact with Stripe's managed UI. We don't build payment forms or card input fields.

**The database handles state.** A local SQLite database tracks what Stripe events mean in our domain: credit balances, subscription tier, usage history. This is the source of truth for "can this user perform an action right now?"

**Webhooks bridge the gap.** When something happens in Stripe—a payment succeeds, a subscription changes, a cancellation takes effect—Stripe sends a webhook. Our code translates that billing event into a credit operation.

The flow looks like this:

```
User clicks "Subscribe"
    → We create a Stripe Checkout session
    → User pays in Stripe's UI
    → Stripe sends webhook: subscription.created
    → We allocate credits based on tier
    → User can now perform actions
```

And for ongoing usage:

```
User clicks action button
    → We check local database for credits
    → If credits > 0, decrement and allow
    → If credits = 0, reject
    → (Stripe never knows this happened)
```

The key insight is that Stripe isn't involved in the moment-to-moment enforcement. That's too latency-sensitive and too specific to our business logic. Stripe gets involved at billing boundaries—when money moves or subscription status changes.

---

## How the Webhook Handler Works

The webhook handler ([`app/api/webhooks/stripe/route.ts`](../app/api/webhooks/stripe/route.ts)) is the nervous system connecting Stripe to our application state. It receives raw events from Stripe, validates them, and dispatches to the appropriate handler.

```typescript
switch (event.type) {
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
  // ... other events
}
```

Notice how we extract the `priceId` from Stripe's subscription object, then translate it to our tier concept via `getTierFromPriceId()`. Stripe knows `price_abc123`. We know `expert`. The mapping lives in [`lib/constants.ts`](../lib/constants.ts):

```typescript
export const TIERS = {
  starter: {
    name: 'Starter',
    price: 1000, // $10.00 in cents
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
```

This is where business logic meets billing infrastructure. The `credits` field is ours—Stripe has no idea it exists.

---

## The Credit Consumption Logic

When a user clicks the action button, the request hits our API, which calls `useCredit()` in [`lib/credits.ts`](../lib/credits.ts). This is the heart of the enforcement logic:

```typescript
export function useCredit(userId: number = 1): UseCreditsResult {
  return transaction(() => {
    // Check subscription status
    const subscription = getSubscription(userId)
    if (!subscription || !canUseCredits(subscription.status)) {
      return {
        success: false,
        error: 'No active subscription',
      }
    }

    // Get current credits
    const credits = getCredits(userId)
    const { subscription_credits, addon_credits } = credits

    // Determine which credit type to use
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
      return {
        success: false,
        error: 'No credits available',
      }
    }

    // Update credits
    updateCredits(userId, newSubscriptionCredits, newAddonCredits)
    incrementActionCount(userId)

    // Log the event
    logCreditEvent(userId, 'usage', {
      creditsChange: -1,
      creditType,
      balanceBefore: subscription_credits + addon_credits,
      balanceAfter: newSubscriptionCredits + newAddonCredits,
      description: `Used 1 ${creditType} credit`,
    })

    return {
      success: true,
      balance: { ... },
      actionCount: actions?.total_count ?? 0,
    }
  })
}
```

Several things are happening here:

1. **Subscription check first.** Even if you have credits, you can't use them without an active (or trialing, or past_due) subscription. This prevents canceled users with leftover add-on credits from continuing to use the product.

2. **Consumption order matters.** We check subscription credits first, then add-ons. Since subscription credits expire and add-ons don't, this maximizes value for the user.

3. **Wrapped in a transaction.** The `transaction()` wrapper ensures atomicity. If two requests arrive simultaneously, one will wait for the other to complete. No double-spending.

4. **Audit logging.** Every credit operation is logged with before/after balances. This creates an audit trail for debugging, support, and analytics.

---

## The Renewal Cycle

When a billing cycle ends and a new one begins, Stripe sends an `invoice.paid` event. Our handler in the webhook route checks if it's a renewal (not an initial subscription):

```typescript
case 'invoice.paid': {
  const invoice = event.data.object as Stripe.Invoice

  // Only process subscription renewals (not initial creation)
  if (invoice.billing_reason === 'subscription_cycle') {
    const subscriptionId = invoice.subscription as string
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const priceId = subscription.items.data[0]?.price?.id
    const tier = priceId ? getTierFromPriceId(priceId) : null

    if (tier) {
      handleInvoicePaid(userId, tier, event.id)
    }
  }
  break
}
```

The `handleInvoicePaid` function in [`lib/subscriptions.ts`](../lib/subscriptions.ts) delegates to `allocateSubscriptionCredits()`, which does the actual work:

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

    // Expire any remaining subscription credits first
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

    // Allocate new credits based on tier
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

This is where the "subscription credits expire" rule is enforced. When a new cycle begins, we first log the expiration of any remaining credits (the balance goes to zero), then allocate fresh credits based on the tier. The user starts each cycle with exactly what their tier grants—no rollover.

Add-on credits, stored in a separate column, are untouched by this process.

---

## Idempotency: The Safety Net

Webhooks can arrive more than once. Stripe guarantees at-least-once delivery, not exactly-once. If your server responds slowly or with an error, Stripe will retry. If you're not careful, you might allocate credits twice.

The solution is idempotency. Every Stripe event has a unique ID, and we track which ones we've processed:

```typescript
// In the webhook handler
if (hasProcessedStripeEvent(event.id)) {
  console.log(`Skipping already processed event: ${event.id}`)
  return NextResponse.json({ received: true, skipped: true })
}
```

The `hasProcessedStripeEvent()` function in [`lib/db.ts`](../lib/db.ts) checks our `credit_log` table:

```typescript
export function hasProcessedStripeEvent(stripeEventId: string): boolean {
  const result = getDb()
    .prepare('SELECT 1 FROM credit_log WHERE stripe_event_id = ? LIMIT 1')
    .get(stripeEventId)
  return !!result
}
```

When we log a credit event, we include the `stripeEventId`. If we see the same ID again, we skip processing. This makes the entire webhook handler idempotent—you can replay events safely.

---

## The Two-Phase Cancellation

Cancellation in Stripe isn't instant. When a user clicks "Cancel" in the Customer Portal, Stripe sets `cancel_at_period_end: true` on the subscription and sends a `subscription.updated` event. The subscription is still active—they've just scheduled its end.

```typescript
case 'customer.subscription.updated': {
  // ... extract data ...
  handleSubscriptionUpdated(userId, {
    // ... other fields ...
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  }, event.id)
  break
}
```

We record this flag in our database and show it in the UI. The user keeps their credits and access until the period ends.

When the period finally ends, Stripe sends `subscription.deleted`:

```typescript
case 'customer.subscription.deleted': {
  const subscription = event.data.object as Stripe.Subscription
  handleSubscriptionDeleted(userId, subscription.id, event.id)
  break
}
```

Now we expire the remaining subscription credits:

```typescript
export function handleSubscriptionDeleted(
  userId: number,
  stripeSubscriptionId: string,
  stripeEventId?: string
): void {
  // Expire remaining subscription credits
  expireSubscriptionCredits(userId, stripeEventId, 'Subscription canceled')

  // Update status
  upsertSubscription(userId, {
    status: 'canceled',
    cancel_at_period_end: false,
  })
}
```

The add-on credits survive. They're still in the database, but `useCredit()` will reject attempts to use them because the subscription status is now `canceled` and `canUseCredits('canceled')` returns false.

---

## What Stripe Handles (So We Don't Have To)

It's worth appreciating how much complexity Stripe absorbs:

**Payment collection.** Card validation, 3D Secure, retry logic, decline handling. We never see card numbers.

**Subscription billing.** Proration calculations for upgrades/downgrades, invoice generation, billing cycle management.

**The Customer Portal.** A complete UI for users to update payment methods, view invoices, change plans, and cancel. We literally just redirect them there:

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

**Checkout.** The entire payment flow—entering card details, handling failures, showing confirmations. We create a session and redirect:

```typescript
export async function createSubscriptionCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  trialDays?: number
): Promise<Stripe.Checkout.Session> {
  const params: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  }

  if (trialDays && trialDays > 0) {
    params.subscription_data = { trial_period_days: trialDays }
  }

  return stripe.checkout.sessions.create(params)
}
```

By offloading all of this to Stripe, our codebase stays focused on what's unique to our product: the credit system.

---

## The Tradeoffs We Made

Every architecture involves tradeoffs. Here are the ones we chose:

**Local database over Stripe metadata.** We could theoretically store credits in Stripe's customer metadata. But metadata is untyped, has no transactions, and would require API calls on every credit check. SQLite gives us atomicity, speed, and SQL's expressiveness.

**Caching subscription state locally.** We copy Stripe's subscription data into our database via webhooks. This means we might briefly be out of sync if a webhook is delayed. We accept this because checking Stripe's API on every request would add latency and rate limit concerns. For critical moments (like a user trying to act when we think they have no credits but renewal might have just happened), we could add a real-time Stripe check—but for this prototype, we trust the webhooks.

**Webhook-based architecture over polling.** We react to Stripe events rather than periodically querying Stripe for changes. This is more efficient and more responsive, but it means we depend on webhook delivery. In production, you'd add monitoring for missed webhooks.

**Single-user prototype.** Real applications have user authentication and multi-tenancy. Here, we hardcode `userId = 1` everywhere. This simplifies the prototype without changing the fundamental patterns.

**SQLite over PostgreSQL.** For a prototype, SQLite is perfect—no setup, portable, fast enough. In production, you'd likely use PostgreSQL for better concurrency and operational tooling. The code would barely change; SQLite and PostgreSQL speak similar SQL.

---

## What We Learned

Building this prototype crystallized several insights:

**Stripe is a billing system, not an entitlement system.** It answers "how much should we charge?" not "can this user do this?" The latter is your job.

**Webhooks are the integration point.** They're how Stripe tells you about the world. Treat them as the source of truth for billing events, and translate them into your domain.

**Idempotency isn't optional.** Webhooks can arrive multiple times. Your handlers must be safe to re-run.

**Separation of concerns pays off.** By keeping credit logic in our code and billing logic in Stripe, each system stays focused. Changes to credit rules don't require Stripe configuration changes. Stripe updates don't break our credit logic.

**The audit log is invaluable.** Every credit operation is logged with context. When something seems wrong, you can trace exactly what happened and why.

---

## Conclusion

The architecture that emerged from this prototype is straightforward once you see it: Stripe handles money, your database handles meaning, and webhooks translate between them. The code is modest—a few hundred lines of credit logic, a webhook handler with a switch statement, some database queries.

What makes it work is respecting the boundary. We don't try to make Stripe understand credits. We don't try to re-implement billing. We let each system do what it's good at, and we build a clean bridge between them.

The result is a system that's easy to reason about, easy to test, and easy to extend. When the business rules change—new tiers, different expiration policies, bonus credits—the changes are localized to our code. Stripe keeps humming along, collecting payments like it always has.

That's the goal: a partnership where each side contributes its strengths, and the seams are clean enough that you barely notice them.
