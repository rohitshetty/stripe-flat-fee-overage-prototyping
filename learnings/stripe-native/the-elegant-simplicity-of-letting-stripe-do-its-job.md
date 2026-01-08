# The Elegant Simplicity of Letting Stripe Do Its Job

There's a particular kind of satisfaction that comes from deleting code.

Not the nervous deletion of something that might break, but the confident removal of complexity that was never necessary in the first place. The kind where you look at 300 lines of careful, tested, edge-case-handling logic and realize: someone else already solved this problem better than you ever could.

This is the story of how we rebuilt a subscription system by doing less.

## The Problem We Were Solving Wrong

Our original implementation was a credits-based system. Users subscribe to a tier, receive a monthly allocation of credits, and spend them on actions. When credits hit zero, users are blocked until they buy more or wait for renewal.

It sounds simple. It wasn't.

The code told the story. Our `lib/credits.ts` file had grown to 258 lines. It handled credit allocation, consumption, expiration, priority (subscription credits before addon credits), balance tracking, and audit logging. Our webhook handler was 187 lines of careful state management—allocating credits on subscription creation, expiring them on renewal, calculating upgrade differences, handling addon purchases.

We had five database tables tracking credits, credit logs, subscriptions, users, and addon purchases. Every operation required careful transaction handling because credits could be consumed from multiple sources in a single action.

And the edge cases. Oh, the edge cases.

What happens when a user upgrades mid-cycle? Do they get the difference in credits, or the full new allocation? What about unused credits from the old tier? When exactly do credits expire—at the moment of renewal, or when the invoice is paid? What if the payment fails?

Each question spawned more code. More tests. More ways to be wrong.

## The Shift in Mental Model

The breakthrough came when we stopped asking "how do we track credits better?" and started asking "why are we tracking credits at all?"

The answer was uncomfortable: we were doing Stripe's job, poorly.

Stripe has a feature called [Meters](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage). It's designed exactly for this: you send usage events, Stripe aggregates them, and Stripe handles billing. No local state. No synchronization. No edge cases around renewal timing.

But Meters work on a post-paid model. Users aren't blocked when they exceed their "included" amount—they're just charged more at the end of the billing cycle.

This felt wrong at first. Our whole system was built around the idea of blocking users at zero credits. Wasn't that the point?

We had to ask ourselves: was blocking users actually serving them, or was it just easier for us to implement?

The honest answer: most SaaS products don't need hard blocking. They need usage tracking and fair billing. The credit system wasn't a feature—it was an implementation detail we'd elevated to a product decision.

## The Stripe Native Architecture

Here's what the Stripe-native implementation looks like:

```
User performs action
       ↓
App sends meter event to Stripe (1 line of code)
       ↓
Stripe aggregates usage automatically
       ↓
At billing cycle end, Stripe calculates:
  - Included actions: $0
  - Overage actions: $X per action
       ↓
Stripe charges the customer
```

That's it. The entire usage tracking implementation is ~50 lines of code in [`lib/native/meter.ts`](../../lib/native/meter.ts):

```typescript
export async function recordAction(stripeCustomerId: string): Promise<RecordActionResult> {
  const meterEvent = await stripe.billing.meterEvents.create({
    event_name: METER_EVENT_NAME,
    timestamp: Math.floor(Date.now() / 1000),
    payload: {
      stripe_customer_id: stripeCustomerId,
      value: '1',
    },
  })

  return {
    success: true,
    meterEventId: meterEvent.identifier,
  }
}
```

Compare this to the credit consumption logic it replaced—balance checks, locks, priority handling, audit logging. All gone. Not refactored. Deleted.

## How Subscriptions Work

Each subscription tier has two prices in Stripe:

1. **License fee** — A flat monthly charge (e.g., $10/month for Starter)
2. **Usage price** — A metered price tied to our Meter, with tiered pricing

The tiered pricing is where the magic happens. We configure it so that the first N actions (the "included" amount) cost $0, and anything beyond costs $X per action.

For example, the Starter tier ($10/month, 5 included actions, $2/overage):

| Actions | Per-action cost | Total |
|---------|-----------------|-------|
| 1-5     | $0.00           | $0    |
| 6+      | $2.00           | $2/ea |

A user who performs 3 actions pays $10 (just the license fee). A user who performs 8 actions pays $10 + $6 = $16.

Stripe calculates all of this automatically based on the meter events we send.

## User Scenarios

Let's walk through the scenarios this architecture handles:

### Scenario 1: Normal Usage Within Limits

Sarah subscribes to the Expert tier ($15/month, 10 included actions). Over the month, she performs 7 actions.

**What happens:**
- Each action sends a meter event to Stripe
- Dashboard shows "7 / 10 actions used"
- At cycle end, Stripe charges $15 (license only)
- Meter resets automatically for the new period

**Code involved:** One API call per action. That's it.

### Scenario 2: Overage Usage

Mike is on the same Expert tier. He has a busy month and performs 15 actions.

**What happens:**
- Actions are never blocked (post-paid model)
- Dashboard shows "15 / 10 actions" with overage indicator
- Dashboard shows estimated overage charge: ~$30 (5 × $6)
- At cycle end, Stripe charges $15 + $30 = $45

**Code involved:** Same single API call. The overage calculation happens entirely in Stripe.

### Scenario 3: Trial Period

Emma starts a 14-day trial on the Pro tier.

**What happens:**
- Subscription created with `trial_period_days: 14`
- Status shows as "trialing"
- Usage is tracked by Stripe Meters during trial
- At trial end, if she converts, usage during trial is billed normally
- If she doesn't convert, subscription cancels, no charge

**Code involved:** One flag in the checkout session. Stripe handles trial→active transition.

### Scenario 4: Mid-Cycle Upgrade

David is on Starter ($10/month, 5 included). He's used 3 actions. He upgrades to Expert ($15/month, 10 included).

**What happens:**
- Subscription updated via `stripe.subscriptions.update()`
- Stripe prorates the license fee difference
- Meter events continue counting—now against Expert's limits
- His 3 existing actions still count toward this period's usage

**Code involved:**
```typescript
await stripe.subscriptions.update(subscriptionId, {
  items: [
    { id: licenseItemId, price: newLicensePriceId },
    { id: usageItemId, price: newUsagePriceId },
  ],
  proration_behavior: 'create_prorations',
})
```

No credit transfer logic. No "remaining credits" calculation. The usage just continues.

### Scenario 5: Failed Payment

Lisa's card fails at renewal.

**What happens:**
- Stripe sends `invoice.payment_failed` webhook
- We update local status to `past_due`
- Stripe's dunning emails kick in automatically
- User can still perform actions (status is past_due, not canceled)
- When payment succeeds, status returns to active

**Code involved:** A webhook handler that updates one database field.

### Scenario 6: Cancellation

Tom cancels his subscription.

**What happens:**
- Stripe sets subscription to cancel at period end
- User retains access until period ends
- Usage continues to be tracked
- At period end, final invoice includes any overages
- Subscription moves to canceled

**Code involved:** Nothing special. Stripe handles the timing.

## The Webhook Handler That Does Almost Nothing

The webhook handler in the Stripe-native implementation is a study in what you *don't* need to do:

```typescript
case 'customer.subscription.created':
case 'customer.subscription.updated': {
  const subscription = event.data.object as Stripe.Subscription

  // Find tier from price ID
  const tier = getTierFromPriceId(subscription)

  // Update local state
  upsertNativeSubscription(userId, {
    stripe_subscription_id: subscription.id,
    tier,
    status: subscription.status,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
  })
  // NOTE: No credit allocation - Stripe Meters track usage automatically
  break
}
```

The comments tell the story. Every `// NOTE: No...` is logic we didn't have to write:

- No credit allocation on subscription creation
- No credit expiration on renewal
- No addon handling (overages replace addons)
- No credit transfer on upgrade
- No balance synchronization

## Corner Cases and How They're Handled

### Corner Case 1: Meter Event Aggregation Delay

**The issue:** When you send a meter event, there's a slight delay (seconds to minutes) before it appears in Stripe's aggregated summaries.

**How we handle it:** The UI shows a "Synced at HH:MM:SS" timestamp so users know when data was last fetched. After performing an action, we wait 1.5 seconds before refetching to allow aggregation.

**Why it's acceptable:** This is a dashboard display issue, not a billing issue. Stripe's billing is always accurate—it's just the real-time display that lags slightly.

### Corner Case 2: Trial Usage Billing

**The issue:** What happens to usage during a trial if the user converts?

**How Stripe handles it:** Usage during trial is included in the first invoice after conversion. The meter tracks all events, trial or not. The tiered pricing still applies—included actions are free, overages are charged.

**Reference:** [Stripe Docs: Free trials with usage-based billing](https://docs.stripe.com/billing/subscriptions/usage-based#free-trials)

### Corner Case 3: Mid-Cycle Tier Changes

**The issue:** User upgrades from Starter (5 included) to Expert (10 included) after using 4 actions. Do they get 6 more "free" actions, or 10?

**How Stripe handles it:** The usage meter doesn't reset mid-cycle. They've used 4 of whatever tier they're on. After upgrade, the tiered pricing changes—now their first 10 actions are at $0/ea. Since they've only used 4, they have 6 more before overages kick in.

This is actually more fair than the credits model, where we had to decide whether to give them the difference (5 more credits) or the full new allocation (10 credits).

### Corner Case 4: Subscription Status During Payment Retry

**The issue:** Payment fails, Stripe retries over several days. What's the user's status?

**How we handle it:** Status is `past_due` but the user can still perform actions. We check for `['active', 'trialing', 'past_due']` as valid statuses. Only `canceled` blocks access.

**Why:** Blocking users immediately on failed payment is usually wrong. Give Stripe's dunning process time to work. Most failed payments resolve within a few days.

### Corner Case 5: High-Volume Usage Tracking

**The issue:** What if users perform hundreds of actions per minute?

**How Stripe handles it:** Meter events are designed for high throughput. Stripe recommends batching if you're sending thousands of events, but for most SaaS products, individual event recording is fine.

**Reference:** [Stripe Docs: Recording usage](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage#batch-events)

### Corner Case 6: Displaying Real-Time Usage

**The issue:** We want to show users their current usage, but meter aggregation isn't instant.

**How we handle it:** We query `stripe.billing.meters.listEventSummaries()` with the current billing period dates. This returns the aggregated count. For real-time feedback, the UI also shows a local "+X this session" counter that updates immediately on action.

```typescript
const summary = await stripe.billing.meters.listEventSummaries(METER_ID, {
  customer: stripeCustomerId,
  start_time: Math.floor(periodStart.getTime() / 1000),
  end_time: Math.floor(periodEnd.getTime() / 1000),
})
```

## What We Gave Up

Let's be honest about the tradeoffs:

### 1. Hard Blocking
Users can't be blocked at a specific limit. If you need "absolutely no service after N uses," this architecture doesn't support it without adding application-side checks.

**Mitigation:** You could add a soft check in your app that warns users or requires confirmation after they exceed included actions. But you can't prevent billing—Stripe will charge for overages regardless.

### 2. Credit Purchases
Users can't "buy more credits" as a one-time purchase. Overages are automatic and billed at cycle end.

**Mitigation:** You could allow tier upgrades (which increases included actions) or implement a separate prepaid credit system alongside meters for users who want to prepay.

### 3. Credit Pooling / Rollover
Unused "included actions" don't roll over to the next month.

**Mitigation:** This is actually a feature, not a bug, for most businesses. Rollover credits create accounting complexity and can lead to users hoarding credits.

### 4. Immediate Billing Feedback
Users don't see exactly what they'll be charged until Stripe calculates it at period end.

**Mitigation:** We calculate and display an estimated overage charge in the UI based on current usage and tier pricing. It's not penny-perfect but it's close enough.

## The Database Schema

The Stripe-native implementation uses 3 tables:

```sql
-- Users (just identity)
native_users (
  id, email, stripe_customer_id, created_at
)

-- Subscription state (minimal - Stripe is truth)
native_subscriptions (
  id, user_id, stripe_subscription_id, tier, status,
  current_period_start, current_period_end,
  created_at, updated_at
)

-- Local action log (for UI only, not billing)
native_action_log (
  id, user_id, stripe_meter_event_id, created_at
)
```

Compare to the credits implementation:
- `users` — Same
- `subscriptions` — Same
- `credits` — Tracks balances by type, expiration dates
- `credit_log` — Audit trail of every credit operation
- `addon_purchases` — One-time credit pack purchases

We deleted two tables and ~30 columns of schema.

## Implementation Reference

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| [`lib/native/meter.ts`](../../lib/native/meter.ts) | Stripe Meter integration | ~50 |
| [`lib/native/db.ts`](../../lib/native/db.ts) | Database queries | ~60 |
| [`lib/native/constants.ts`](../../lib/native/constants.ts) | Tier definitions | ~90 |
| [`app/api/native/action/route.ts`](../../app/api/native/action/route.ts) | Action endpoint | ~40 |
| [`app/api/native/status/route.ts`](../../app/api/native/status/route.ts) | Status endpoint | ~95 |
| [`app/api/native/webhooks/stripe/route.ts`](../../app/api/native/webhooks/stripe/route.ts) | Webhook handler | ~70 |

**Total: ~400 lines** for the entire backend, including comments and types.

### Stripe Dashboard Setup

1. **Create a Meter** in Stripe Dashboard → Billing → Meters
   - Event name: `action_performed`
   - Aggregation: `sum`
   - Customer mapping: `stripe_customer_id` from payload

2. **Create Products with Two Prices:**
   - License price: Flat rate, recurring monthly
   - Usage price: Metered, linked to your Meter, with tiered pricing

3. **Configure Tiered Pricing** on usage price:
   - First N units: $0.00 (included in license)
   - Additional units: $X.XX each

4. **Set up Webhook** endpoint for `customer.subscription.*` and `invoice.*` events

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_...
STRIPE_METER_ID=mtr_...
STRIPE_NATIVE_WEBHOOK_SECRET=whsec_...

# Per-tier price IDs
STRIPE_NATIVE_STARTER_LICENSE_PRICE_ID=price_...
STRIPE_NATIVE_STARTER_USAGE_PRICE_ID=price_...
STRIPE_NATIVE_EXPERT_LICENSE_PRICE_ID=price_...
STRIPE_NATIVE_EXPERT_USAGE_PRICE_ID=price_...
STRIPE_NATIVE_PRO_LICENSE_PRICE_ID=price_...
STRIPE_NATIVE_PRO_USAGE_PRICE_ID=price_...
```

## Further Reading

- [Stripe Meters Documentation](https://docs.stripe.com/billing/subscriptions/usage-based) — The official guide to usage-based billing
- [Recording Usage Events](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage) — How to send meter events
- [Tiered Pricing](https://docs.stripe.com/products-prices/pricing-models#tiered-pricing) — Setting up graduated/tiered pricing
- [Subscription Lifecycle](https://docs.stripe.com/billing/subscriptions/overview#subscription-lifecycle) — Understanding subscription states
- [Billing Thresholds](https://docs.stripe.com/billing/subscriptions/usage-based/billing-thresholds) — Triggering invoices before period end

## The Lesson

The best code is code you don't have to write.

We spent weeks building a credit system that handled allocation, consumption, expiration, synchronization, and edge cases. It worked. It was tested. It was still wrong.

Wrong because every line of that code was a liability—something that could break, something that needed maintenance, something that might not handle the next edge case we discovered.

Stripe's Meters aren't perfect. The post-paid model doesn't fit every business. But for the vast majority of usage-based billing scenarios, it's good enough. And "good enough" from a system that processes billions of dollars in payments is better than "perfect" from code you wrote last month.

Sometimes the elegant solution isn't about writing better code. It's about recognizing when someone else has already solved your problem, and having the humility to let them.

---

*This essay documents the Stripe-native implementation in the subscription-prototype repository. For the alternative approach using local credit tracking, see the [custom-entitlement](../custom-entitlement/) documentation.*
