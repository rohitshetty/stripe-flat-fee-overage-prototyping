# The Two Paths to Prepaid Credits: Stripe's Native System vs. Rolling Your Own

> **References:**
> - [Stripe Blog: Introducing Credits for Usage-Based Billing](https://stripe.com/blog/introducing-credits-for-usage-based-billing)
> - [Stripe Docs: Billing Credits](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits)
> - [Stripe Docs: Meters](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-meter)
> - [Stripe Docs: Credit Grants API](https://docs.stripe.com/api/billing/credit-grant)

There's a moment in every billing integration where you discover that Stripe has a feature for the thing you're about to build. You feel a mix of relief and suspicion. Relief because maybe you don't have to write that code. Suspicion because "native feature" and "exactly what you need" are rarely the same thing.

Stripe recently launched Credits for usage-based billing. It's designed for exactly the scenario we're dealing with: customers who prepay for usage, with that prepayment tracked and applied to their bills. Reading the announcement, you'd be forgiven for thinking we could delete half our codebase and let Stripe handle it.

We can't. But the reasons why are instructive, and understanding them illuminates something deeper about the architecture of billing systems.

---

## How Stripe's Credit System Works

Let's start with what Stripe actually built.

Stripe Credits is a ledger system layered on top of their [metered billing infrastructure](https://docs.stripe.com/billing/subscriptions/usage-based). The core abstraction is a [**Credit Grant**](https://docs.stripe.com/api/billing/credit-grant)—a bucket of prepaid value assigned to a customer. You create a grant, the customer accumulates usage via [Meters](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-meter), and when the invoice finalizes, Stripe applies available credits before charging their card.

The workflow looks like this:

```
1. Customer purchases credits
   → You create a Credit Grant via API
   → Grant enters "active" state with a balance

2. Customer uses your product
   → You report usage events to a Stripe Meter
   → Meter accumulates usage throughout the billing period

3. Invoice finalizes
   → Stripe calculates total usage charges
   → Stripe applies available credits from grants
   → Stripe charges the remaining balance to the card
   → Grant balance decrements accordingly
```

The system is sophisticated. Grants can have [expiration dates](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits#expiration). They can have [priority levels](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits#priority) (promotional credits before paid credits). They track every transaction in an [immutable ledger](https://docs.stripe.com/api/billing/credit-balance-transaction). They handle multi-currency scenarios and tax calculations.

If you squint, this looks exactly like what we need. Prepaid credits. Usage tracking. Automatic application. What's the catch?

---

## What We'd Build If We Used Stripe Credits

Let's walk through the implementation. Our product has three tiers (Starter, Expert, Pro) with different monthly credit allocations. Users can also buy add-on packs. Credits are consumed when users perform actions.

**Step 1: Set up Meters**

First, we'd create a Meter in Stripe to track usage:

```typescript
const meter = await stripe.billing.meters.create({
  display_name: 'Actions',
  event_name: 'action_performed',
  default_aggregation: { formula: 'count' },
  customer_mapping: {
    event_payload_key: 'stripe_customer_id',
    type: 'by_id',
  },
})
```

**Step 2: Create metered prices**

Each tier needs a price connected to this meter:

```typescript
const expertPrice = await stripe.prices.create({
  currency: 'usd',
  recurring: {
    interval: 'month',
    usage_type: 'metered',
    meter: meter.id,
  },
  unit_amount: 0, // We charge via credits, not per-unit
  product: 'prod_xyz',
})
```

Wait—`unit_amount: 0`? Yes. Because in a pure prepaid model, we don't want to charge per action. We want to apply credits. The metered price exists to track usage, not to generate charges directly.

**Step 3: Grant credits on subscription**

When someone subscribes to Expert tier, we create a Credit Grant:

```typescript
await stripe.billing.creditGrants.create({
  customer: customerId,
  name: 'Expert Monthly Credits',
  amount: {
    type: 'monetary',
    value: {
      currency: 'usd',
      amount: 500, // 5 credits × 100 cents each
    },
  },
  applicability_config: {
    scope: {
      price_type: 'metered',
    },
  },
  effective_at: subscriptionStartTimestamp,
  expires_at: subscriptionEndTimestamp,
})
```

Here's where things get interesting. Stripe Credits are monetary. They represent dollar amounts, not abstract units. If each "action" costs $1.00, you grant $5.00 for 5 credits. The translation between "credits" and "dollars" happens at grant creation.

**Step 4: Report usage**

When a user performs an action, we report it to the Meter via [meter events](https://docs.stripe.com/api/billing/meter-event):

```typescript
await stripe.billing.meterEvents.create({
  event_name: 'action_performed',
  payload: {
    stripe_customer_id: customerId,
    value: '1',
  },
})
```

**Step 5: Let Stripe handle invoicing**

At the end of the billing period, Stripe does the math:
- User performed 3 actions
- Each action costs $1.00 (based on our pricing)
- Total usage: $3.00
- Available credits: $5.00
- Credits applied: $3.00
- Amount charged to card: $0.00
- Remaining credit balance: $2.00

If they'd performed 7 actions, they'd have $5.00 in credits applied, $2.00 charged to their card.

---

## The Problem That Doesn't Appear Until Runtime

Read through that implementation again. Did you notice what's missing?

At no point did we check whether the user *should be allowed* to perform the action.

When the user clicks the button for their 6th action (and they only have 5 credits), what happens? The meter event gets recorded. Stripe happily accepts it. The action proceeds.

At the end of the month, Stripe will apply the 5 credits and charge them for the 6th action. From Stripe's perspective, this is working correctly. The customer used something, so they pay for it.

But that's not our product model. We sell *prepaid* credits. When you're out, you're out. You can't perform action #6 until you buy more. The action should fail at request time with a message like "No credits remaining."

Stripe Credits has no concept of blocking. The [documentation](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits) says it plainly:

> "No usage blocking occurs. The system doesn't prevent usage—it simply 'won't' apply credits to invoices that fall outside eligibility windows. Customers can still incur charges beyond available credits."

This isn't a bug or limitation. It's a design choice that reflects what Stripe Credits is *for*: managing prepaid billing credits that get applied to invoices. It's a financial accounting system, not an entitlement enforcement system.

---

## The Fundamental Mismatch

Here's the conceptual gap that makes all the difference:

**Stripe Credits answers:** "How should we settle this customer's bill?"

**Our product requires:** "Can this customer perform this action right now?"

These are different questions that get asked at different times.

Stripe's question is asked at invoice finalization—after usage has already occurred, potentially days or weeks after the actions were performed. The answer determines payment allocation: how much comes from credits versus how much gets charged to the card.

Our question is asked at the moment of the action—synchronously, while the user is waiting for a response. The answer determines whether to proceed or block. There's no "bill them later" option. The action either happens or it doesn't.

You could theoretically query Stripe's [credit balance](https://docs.stripe.com/api/billing/credit-balance-summary) before each action:

```typescript
const creditBalance = await stripe.billing.creditBalanceSummary.retrieve({
  customer: customerId,
  filter: { applicability_scope: { price_type: 'metered' } },
})

if (creditBalance.balances[0].available.monetary.value >= 100) {
  // Allow action
} else {
  // Block action
}
```

But this introduces problems:

1. **Latency.** Every action requires an API call to Stripe. That's 100-300ms of latency before the user can proceed.

2. **Race conditions.** Between checking the balance and reporting usage, another request might have consumed credits. There's no atomic "check and decrement" operation.

3. **Rate limits.** Stripe's API has [rate limits](https://docs.stripe.com/rate-limits). High-traffic applications would hit them quickly.

4. **Eventual consistency.** Meter events and credit grants don't update instantaneously. You might check a stale balance.

The fundamental architecture of Stripe Credits assumes that usage happens freely and settlement happens later. Retrofitting real-time enforcement onto that model creates friction at every turn.

---

## What Our Implementation Does Instead

Our implementation puts the enforcement logic where it belongs: in our application, at the moment of action.

```typescript
export function useCredit(userId: number): UseCreditsResult {
  return transaction(() => {
    const credits = getCredits(userId)

    if (credits.subscription_credits > 0) {
      updateCredits(userId, credits.subscription_credits - 1, credits.addon_credits)
      return { success: true, /* ... */ }
    } else if (credits.addon_credits > 0) {
      updateCredits(userId, credits.subscription_credits, credits.addon_credits - 1)
      return { success: true, /* ... */ }
    } else {
      return { success: false, error: 'No credits available' }
    }
  })
}
```

This code runs in a database transaction. It checks the balance, decrements if positive, and rejects if zero—all atomically. There's no window for race conditions. The check and the decrement are a single operation.

The latency is a database read and write—single-digit milliseconds instead of hundreds. There are no external API calls in the hot path. The user clicks, we check locally, we respond instantly.

Stripe is still involved, but at the boundaries:

- When money moves (subscription payment, add-on purchase), Stripe sends a webhook
- We translate that billing event into credit allocation
- The credits live in our database
- Enforcement happens locally

The architecture respects what each system is good at. Stripe handles the complexity of payment collection, subscription management, and invoice generation. Our database handles the simplicity of "here's a number, decrement it, reject if zero."

---

## A Side-by-Side Comparison

Let's make this concrete with a scenario: A user on the Expert tier (5 credits/month) performs their 6th action.

**With Stripe Credits:**

```
User clicks action button
→ API receives request
→ Report meter event to Stripe (100-300ms)
→ Stripe accepts event, queues for processing
→ Action proceeds
→ Response returned to user
→ ... time passes ...
→ End of billing period
→ Stripe calculates: 6 actions × $1 = $6
→ Stripe applies 5 credits ($5)
→ Stripe charges card for $1
→ User sees unexpected charge on statement
```

The user was never blocked. They might not even realize they overspent until they see the invoice.

**With our implementation:**

```
User clicks action button
→ API receives request
→ Check local database (1-5ms)
→ subscription_credits = 0, addon_credits = 0
→ Return error: "No credits available"
→ Response returned to user (< 50ms total)
→ UI shows "Purchase more credits"
→ User decides whether to buy more
```

The user is blocked immediately. They make an informed decision about whether to purchase more credits. There's no surprise charge at the end of the month.

---

## What Each Approach Does and Doesn't Do

**Stripe Credits does:**
- Track prepaid balances with an immutable ledger
- Apply credits to invoices automatically
- Handle expiration dates and priorities
- Support promotional credits alongside paid credits
- Provide reporting and analytics on credit usage
- Manage the financial accounting of prepaid revenue

**Stripe Credits doesn't:**
- Block actions when credits are exhausted
- Provide real-time balance enforcement
- Offer atomic check-and-decrement operations
- Integrate seamlessly with non-metered pricing models
- Handle non-monetary credit units natively

**Our implementation does:**
- Enforce hard limits at the moment of action
- Provide instant feedback when credits run out
- Handle complex consumption rules (subscription credits before add-ons)
- Maintain an audit log of all credit operations
- Work with any pricing model (flat-rate subscriptions, one-time purchases)

**Our implementation doesn't:**
- Apply credits to invoices (we use flat-rate subscriptions)
- Manage complex multi-currency scenarios
- Provide built-in reporting dashboards
- Handle the monetary value of credits (we track units, not dollars)

---

## When Stripe Credits Makes Sense

This isn't to say Stripe Credits is the wrong choice for everyone. It's the right choice when:

1. **You have post-paid or soft-limit models.** If customers can exceed their prepaid amount and you'll just charge them for the overage, Stripe Credits handles this elegantly. "Your plan includes $50 of usage. Beyond that, we bill your card."

2. **You're tracking monetary value, not abstract units.** Stripe Credits is denominated in currency. If your credits directly map to dollar amounts (like cloud computing credits), the model fits naturally.

3. **Real-time blocking isn't critical.** Some products can tolerate overage and settle later. An analytics platform where queries run asynchronously, for example. The user submits a query, it runs overnight, and if they exceeded their credits, they see it on the invoice.

4. **You want unified financial reporting.** Having credits and billing in one system simplifies accounting. The credit ledger ties directly into Stripe's invoicing and revenue recognition.

Our use case doesn't fit these criteria. We sell abstract credits (not dollar amounts) that grant permission to perform actions (not just track usage for billing). When credits hit zero, the user must stop (not continue and pay overage). The enforcement must be instant (not settled at invoice time).

---

## The Deeper Lesson

Stripe's product philosophy is to handle money so you don't have to. They've built remarkable infrastructure for moving value between parties, tracking obligations, generating compliant invoices, and managing the endless complexity of payment methods across the globe.

But "handling money" and "handling entitlements" are different problems with different shapes.

Money problems are eventually consistent. A charge can be pending for days. An invoice can be disputed. Currency conversions have settlement delays. The system is designed around the reality that money moves slower than bits.

Entitlement problems are immediately consistent. Can this user do this thing? Yes or no, right now. There's no "maybe, we'll figure it out later." The system must answer definitively at the moment the question is asked.

Stripe Credits is a money system applied to the prepaid-credits use case. It does the money part beautifully—tracking balances, applying credits to invoices, maintaining a clean ledger. But it doesn't do the entitlement part because that's not what money systems do.

The architecture we built respects this boundary. We use Stripe for money: collecting payments, managing subscriptions, handling the financial side of add-on purchases. We use our database for entitlements: tracking credits, enforcing limits, answering "can this user act?"

It's more code than if Stripe Credits did everything. But it's the right code in the right place, doing the right job. And when the product requirements change—new consumption rules, different expiration policies, bonus credits for referrals—we change our code, not our payment infrastructure.

That's the tradeoff worth making.
