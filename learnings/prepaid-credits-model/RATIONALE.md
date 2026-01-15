# Why We're Building Credits Ourselves (And Letting Stripe Handle the Rest)

## The Problem We're Solving

Here's what we want to build: a subscription where users pay a flat fee and get a bucket of "clicks" to use however they want. Simple enough, right?

Not quite.

Our model has some specific quirks that make it more interesting than a typical subscription:

| Plan | Price | Clicks | Rollover |
|------|-------|--------|----------|
| Monthly | $250/mo | 100/month | Up to 50 unused clicks carry over |
| Yearly | $5,000/yr | 2,500/year | None—use them or lose them |
| Top-up | $150 | 50 clicks | Never expire |

Users should also be able to pause their subscription when they're not using the product. And they should be able to top up whenever they're running low.

The question we kept asking ourselves: *How much of this can Stripe handle for us?*

Stripe is phenomenal at what it does. It handles payment forms, card storage, PCI compliance, subscription billing cycles, failed payment retries, and a dozen other things we don't want to think about. The dream would be to offload everything—including the click tracking—and just focus on building our core product.

So we went deep into Stripe's documentation. We found three potential approaches. And we learned something important about knowing when to let a platform do its thing, and when to keep things simple yourself.

---

## What Stripe Offers: Three Paths

### Path 1: Stripe Billing Credits

Stripe has a feature called Billing Credits[^1] that sounds like exactly what we need. You can grant customers a pool of credits, and those credits get applied against usage-based charges.

The system is sophisticated. You create "Credit Grants" that track prepaid or promotional balances. Credits flow through five states: Pending, Granted, Depleted, Expired, and Voided[^2]. You can set expiration dates, priority levels, and eligibility rules. It integrates with Stripe's Meters API to track consumption events.

Here's where it gets tricky.

Billing Credits are designed for *post-paid* metered billing. You report usage throughout the month via the Meters API, and then at invoice time—when Stripe finalizes the bill—it calculates total consumption and deducts from the credit balance[^3].

Read that again: *at invoice time*.

This means during the month, the credit balance in Stripe doesn't reflect actual usage. A user could have 100 credits, use 80 of them, and Stripe would still show 100 until the invoice generates. The deduction happens in batch, not in real-time.

For some businesses, this is fine. If you're billing for API calls or compute time and you're okay with users potentially going over their limits (and paying for overages), the end-of-period reconciliation works great.

But we need to *block* users when they run out of clicks. We need to show them an accurate balance in the dashboard. "You have 23 clicks remaining" needs to mean something.

If credits only burn down at invoice finalization, we'd have to track usage locally anyway—just to know when to cut someone off. At that point, what's Stripe's credit system buying us? We'd be maintaining two systems that need to stay in sync.

### Path 2: Usage-Based Billing with Meters

Maybe we're overcomplicating this. What if we skip the credits abstraction and go straight to usage-based billing?

Stripe's Meters[^4] let you report consumption events in real-time. Every click would be a meter event. At billing time, Stripe tallies everything up and charges accordingly.

The appeal is that Stripe handles all the accounting. We just fire events and let the platform figure out invoices.

But this model assumes you're charging *for* usage, not charging *upfront* and deducting usage from a prepaid bucket. Our users pay $250 at the start of the month and get 100 clicks. They don't pay per click—they've already paid.

We could theoretically set up a $0/click metered price and use credits to offset it, but now we're back to the credit system's limitations. And we've added complexity: metered prices, meter events, credit grants, and the timing mismatch between real-time usage and end-of-period deduction.

There's also the rollover problem. Our monthly plan allows up to 50 unused clicks to carry over. Stripe's credit system doesn't have a "cap the rollover at X" feature—credits either expire on a date or they don't[^5]. Implementing our rollover logic would require custom code regardless.

### Path 3: Stripe for Payments, Local Tracking for Credits

What if we draw a cleaner line?

Stripe handles what Stripe is great at: collecting payments, managing subscription lifecycles, handling pause/resume, hosting the customer portal, and sending webhooks when billing events occur.

We handle what requires real-time accuracy: tracking how many clicks a user has left.

This sounds like more work, but let's think about what "tracking credits locally" actually means:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  stripe_customer_id TEXT,
  subscription_clicks INT DEFAULT 0,
  topup_clicks INT DEFAULT 0
);
```

Two integers. That's the entire credit system.

When Stripe tells us (via webhook) that someone's subscription renewed, we run our rollover logic and reset their balance. When someone buys a top-up, we add 50 to their `topup_clicks`. When they use a click, we decrement.

The rollover logic—the part that seems complicated—is about ten lines of code:

```javascript
if (plan === 'monthly') {
  const rollover = Math.min(currentBalance, 50);
  newBalance = 100 + rollover;
} else {
  newBalance = 2500; // yearly, no rollover
}
```

We can show accurate balances instantly. We can block users the moment they hit zero. We don't have to worry about Stripe's credit balance being out of sync with reality.

---

## Why the Hybrid Approach Wins

After mapping out all three paths, the hybrid approach—Stripe for billing, local tracking for credits—is the clear winner. Here's why:

### Real-Time Enforcement

When a user tries to perform a click, we check their balance *before* the action happens. If they're at zero, we block it immediately. No ambiguity, no "you went over and now you owe us" conversations.

With Stripe's credit system, we'd have to build this check locally anyway. The only question is whether we *also* maintain a parallel credit balance in Stripe. The answer is: why would we?

### Simple Mental Model

Two numbers per user: `subscription_clicks` and `topup_clicks`. Subscription clicks reset (with rollover rules) each billing period. Top-up clicks never expire and serve as a backup pool.

When consuming, we deduct from subscription clicks first, then top-ups. This ensures users burn through their "use it or lose it" allocation before dipping into permanent reserves.

### Stripe Does What Stripe Does Best

We're not fighting the platform. Stripe Checkout handles our payment UI[^6]. The Customer Portal lets users pause, resume, update payment methods, and cancel—all without us building those screens[^7]. Webhooks tell us exactly when billing events happen so we can update our local state[^8].

We're using each system for what it's designed to do.

### The Numbers

Here's a rough comparison of implementation complexity:

| Capability | Stripe Credits | Hybrid Approach |
|------------|---------------|-----------------|
| Real-time balance | Local DB + Stripe sync | Local DB only |
| Enforce limits | Local check required | Local check |
| Show remaining | Query local (Stripe stale) | Query local |
| Report usage | Meters API calls | Not needed |
| Rollover logic | Custom code anyway | Custom code |
| Webhook handlers | Complex reconciliation | Simple updates |

The Stripe Credits path requires everything the hybrid path requires, *plus* additional Meters API integration, *plus* reconciliation logic to handle the timing mismatch.

---

## Corner Cases

No billing system is complete without thinking through the edge cases. Here's how we handle the tricky ones:

### Refunds and Chargebacks

What happens if a user pays, uses 30 clicks, then initiates a chargeback?

Our approach: when we receive a `charge.refunded` or `charge.dispute.created` webhook[^9], we have options:

1. **Deduct the granted clicks** — If they got 100 clicks from that payment, remove 100 (capping at zero).
2. **Suspend the account** — For chargebacks specifically, freeze the account pending resolution.
3. **Proportional deduction** — For partial refunds, deduct proportionally.

The key insight: because we control the credit ledger, we can implement whatever policy makes sense. We're not constrained by Stripe's credit grant immutability rules.

### Plan Switching (Monthly to Yearly)

A user on monthly wants to upgrade to yearly mid-cycle. How do we handle the transition?

Stripe's subscription update API handles the billing side—prorating the remaining monthly period against the yearly price[^10]. We need to handle the credits:

1. **Calculate unused monthly clicks** — Say they have 40 of 100 remaining.
2. **Apply rollover rules** — Monthly allows up to 50 rollover, so 40 qualifies.
3. **Add to yearly allocation** — They get 2,500 + 40 = 2,540 clicks for their first year.

Or we could take a simpler approach: yearly subscribers start fresh with 2,500, and any remaining monthly clicks become top-up credits (which never expire). This rewards the upgrade without overcomplicating the math.

The beauty of local tracking: we can pick whichever policy serves our users best.

### Pausing Subscriptions

When a user pauses via the Customer Portal, Stripe sends a `customer.subscription.updated` webhook with `pause_collection` set[^11].

During pause:
- No invoices are charged
- The subscription remains technically "active" in Stripe's system
- We mark them as `paused` locally and stop allowing new clicks

Their remaining clicks freeze in place. When they resume, they pick up where they left off. If they resume in a new billing period, the standard renewal logic applies (reset with rollover).

### Top-Up Stacking

What if a user buys three top-ups in a row? Simple: each adds 50 to `topup_clicks`. There's no cap. If they want to stockpile 500 never-expiring clicks, that's their prerogative.

This also handles the case where someone's subscription lapses but they still have top-up credits. They can use those clicks even without an active subscription (if we want to allow that) or we can require an active subscription to consume any clicks.

---

## The Architecture

Here's how it all fits together:

```
┌────────────────────────────────────────────────────────────────┐
│                        YOUR APP                                │
├────────────────────────────────────────────────────────────────┤
│  Frontend                Backend                 Database      │
│  ┌──────────────┐       ┌──────────────┐       ┌────────────┐ │
│  │ Pricing page │       │ Webhook      │       │ users      │ │
│  │ Dashboard    │◄─────►│ handlers     │◄─────►│ - sub_     │ │
│  │ Top-up btn   │       │              │       │   clicks   │ │
│  │ Portal btn   │       │ /api/click   │       │ - topup_   │ │
│  └──────────────┘       └──────────────┘       │   clicks   │ │
│         │                      ▲               └────────────┘ │
└─────────┼──────────────────────┼──────────────────────────────┘
          │                      │
          ▼                      ▼
┌────────────────────────────────────────────────────────────────┐
│                         STRIPE                                 │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Checkout    │  │   Webhooks   │  │   Customer   │         │
│  │  Sessions    │  │              │  │   Portal     │         │
│  │              │  │ invoice.paid │  │              │         │
│  │ • Subscribe  │  │ sub.updated  │  │ • Pause      │         │
│  │ • Top-up     │  │ sub.deleted  │  │ • Cancel     │         │
│  │              │  │ charge.*     │  │ • Payment    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                │
│  Products: Monthly ($250), Yearly ($5,000), Top-up ($150)     │
└────────────────────────────────────────────────────────────────┘
```

Stripe owns the entire left-to-right flow of money. We own the credit balances that determine what users can do.

---

## Conclusion

When we started this exploration, we hoped Stripe could handle everything. That's the dream with any platform—plug it in and forget about it.

But platforms have opinions. Stripe's Billing Credits are opinionated toward post-paid, usage-based billing with end-of-period reconciliation. That's a great model for many businesses. It's not our model.

Our model needs real-time enforcement, accurate balance display, custom rollover rules, and never-expiring top-ups. Trying to force these requirements into Stripe's credit system would mean building most of the tracking locally anyway, plus a synchronization layer, plus workarounds for the timing mismatch.

The hybrid approach is simpler. Two integers per user. A few webhook handlers. Let Stripe do what Stripe does brilliantly—payments, subscriptions, customer self-service—and keep our credit logic where we can see it, test it, and change it when our business evolves.

Sometimes the best integration is knowing where to draw the line.

---

## References

[^1]: [Stripe Billing Credits Overview](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits) — Documentation for Stripe's credit grant system and how it integrates with usage-based billing.

[^2]: [Credit Grant States](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits) — Credits progress through Pending, Granted, Depleted, Expired, and Voided states.

[^3]: [Credit Burn-Down Timing](https://docs.stripe.com/billing/subscriptions/usage-based/use-cases/credits-based-pricing-model) — "Credits are burned down when the invoice is created at the end of the billing period."

[^4]: [Stripe Meters for Usage Tracking](https://docs.stripe.com/billing/subscriptions/usage-based) — Meters aggregate consumption events over billing periods for usage-based pricing.

[^5]: [Credit Expiration Rules](https://docs.stripe.com/billing/subscriptions/usage-based/billing-credits) — Credits can have expiration dates via `expires_at`, but there's no built-in rollover cap mechanism.

[^6]: [Stripe Checkout for Subscriptions](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — Pre-built hosted payment pages for subscription sign-ups.

[^7]: [Customer Portal Features](https://docs.stripe.com/billing/subscriptions/customer-portal) — Self-service portal for subscription management, payment updates, and cancellation.

[^8]: [Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) — Events like `invoice.paid`, `customer.subscription.updated`, and `customer.subscription.deleted`.

[^9]: [Handling Disputes and Refunds](https://docs.stripe.com/disputes) — Webhook events for `charge.refunded` and `charge.dispute.created`.

[^10]: [Prorating Subscription Changes](https://docs.stripe.com/billing/subscriptions/upgrade-downgrade) — Stripe automatically prorates when switching between subscription prices.

[^11]: [Pause Payment Collection](https://docs.stripe.com/billing/subscriptions/pause-payment) — Pause and resume subscription billing via API or Customer Portal.
