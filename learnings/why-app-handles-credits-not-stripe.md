# Why Your App Must Handle Credit Balances, Not Stripe

## TL;DR

Stripe is a billing system, not an entitlement system. It answers the question "how much should we charge this customer?" but not "can this customer perform this action right now?"

When you have a prepaid credit model—where users pay upfront for a fixed number of actions and get blocked when credits run out—the enforcement logic must live in your application. Stripe can tell you that a customer paid $15 for the Expert plan, but it has no concept of "this payment means 5 actions, and the user has 3 left." That translation, and the gatekeeping that comes with it, is your responsibility.

This isn't a limitation of Stripe. It's a reflection of what Stripe is designed to do. Stripe excels at moving money, retrying failed payments, generating invoices, and managing subscriptions. Your app excels at understanding what those payments mean in the context of your product. The cleanest architecture respects this boundary: let Stripe handle money, let your app handle meaning.

---

## The Prepaid vs Post-Paid Distinction

The credit model described in this project is fundamentally prepaid. A user selects a tier, pays a fixed monthly fee, and receives a predetermined number of credits. Each credit represents permission to perform one action. When credits reach zero, the user cannot perform more actions until they either purchase add-ons or wait for the next billing cycle to replenish their balance.

Stripe's usage-based billing features assume the opposite model. They are built for post-paid scenarios where you track what a customer uses throughout a billing period, then charge them accordingly at the end. The workflow looks like this: customer performs actions freely, you report each action to Stripe as a "usage record," and when the billing period closes, Stripe tallies everything up and generates an invoice.

This post-paid approach works beautifully for infrastructure products. Think of AWS billing—you spin up servers, store data, transfer bytes, and at month's end you get a bill reflecting actual consumption. There's no hard cap. If you use more, you pay more.

But that's precisely what the credit model is designed to avoid. The whole point of prepaid credits is predictability and control. Users know exactly what they're getting for their money. They can't accidentally run up a huge bill. And when they run out, they make a conscious decision to buy more. Stripe's usage tracking doesn't enforce this. It will happily record that a user performed 500 actions when they only paid for 5. It's just taking notes, not standing guard at the door.

---

## What Stripe's Features Actually Do

It's worth examining each Stripe feature that might seem like it could handle credits, and understanding why it falls short.

**Usage Records and Metered Billing** let you report consumption to Stripe for billing purposes. You call an API after each action, incrementing a counter. At billing time, Stripe multiplies usage by your per-unit price and charges the customer. The key insight is that this is a reporting mechanism, not an enforcement mechanism. Stripe receives your usage data and incorporates it into invoices. It doesn't know or care whether the user "should" have been allowed to perform those actions. It doesn't block the 6th action when the user only paid for 5. That logic, if you want it, must exist in your application before you even report the usage.

**Billing Meters**, introduced more recently, improve on usage records by handling high-volume event ingestion more efficiently. You can stream thousands of events to Stripe without worrying about rate limits in the same way. But the fundamental nature hasn't changed. Meters are for recording what happened, not for deciding what should happen. They feed into billing calculations and provide analytics. They don't stand between a user and an action saying "you shall not pass."

**Entitlements** are Stripe's answer to feature gating. They let you define what a customer should have access to based on their subscription. A Pro subscriber might be entitled to "advanced_analytics" while a Starter subscriber is not. This is useful for boolean access control—either you have the feature or you don't. But entitlements don't handle consumable quantities that decrement with use. You can't say "this customer is entitled to 5 actions" in a way that Stripe tracks and enforces.

**Customer Metadata** offers a tempting workaround. Stripe lets you attach arbitrary key-value pairs to customer objects. You could theoretically store `{"credits": "5"}` and update it with each action. But this breaks down quickly in practice. Metadata values are strings, so there's no atomic decrement operation. If a user clicks rapidly, two requests might both read "5", both decrement to "4", and you've given away a free action. You'd need to implement locking, which means round-trips to Stripe on every action, which means latency and rate limit concerns. You've essentially built a worse database on top of Stripe's metadata system.

---

## The Natural Boundary

There's a clean conceptual line between what Stripe knows and what your application knows.

Stripe knows about money. It knows that customer `cus_abc123` is subscribed to price `price_xyz789`, that they're billed $15 on the 15th of each month, that their last payment succeeded, and that their card expires in March. It knows how to retry a failed payment with optimal timing. It knows how to calculate prorated charges when someone upgrades mid-cycle. It knows how to generate a PDF invoice that meets accounting standards.

Your application knows about meaning. It knows that `price_xyz789` corresponds to the "Expert" tier, which grants 5 credits per month. It knows that this particular user has used 3 credits this cycle, so they have 2 remaining. It knows that credits from the subscription expire at cycle end, but credits from add-on purchases persist indefinitely. It knows that subscription credits should be consumed before add-on credits because of these differing expiration rules.

The webhook is the bridge between these two worlds. When Stripe sends an `invoice.paid` event, it's saying "money moved." Your application receives this and translates it into "credits granted." When Stripe sends a `customer.subscription.updated` event indicating an upgrade, your application calculates the credit difference and adds it to the balance.

Trying to collapse these two domains into one creates awkward impedance mismatches. You either end up fighting Stripe's assumptions about how billing works, or you denormalize your business logic into a system that wasn't designed for it.

---

## The Practical Implementation

In practice, the division of labor looks like this.

Your database maintains a credits table. It tracks subscription credits and add-on credits separately for each user. Every time a user performs an action, your backend checks this balance, decrements it if positive, and rejects the request if zero. This is a simple database operation—read the balance, compare to zero, decrement, write back. With proper locking, it's atomic and race-condition-free.

Your webhook handler listens for Stripe events. When `invoice.paid` arrives for a subscription renewal, you look up which tier the user is on, determine the credit allocation for that tier, reset their subscription credits to that amount, and log the event. When `checkout.session.completed` arrives for an add-on purchase, you determine which pack they bought, add those credits to their add-on balance, and log it.

Your API layer ties these together. When a user loads the dashboard, you fetch their credit balance from your database and their subscription status from your cached copy of Stripe's data. When they click the action button, you check the balance, perform the action, decrement credits, and return the new balance. When they want to manage their subscription, you redirect them to Stripe's Customer Portal and let Stripe's UI handle the rest.

The amount of credit-specific code is modest. A couple hundred lines covers the allocation logic, consumption logic, and expiration logic. This is far less complex than trying to bend Stripe's billing primitives into a shape they weren't meant for.

---

## When Stripe-Native Usage Billing Makes Sense

The analysis above shouldn't suggest that Stripe's usage-based features are bad. They're excellent—for the problems they're designed to solve.

If your pricing model is genuinely post-paid and usage-based, Stripe handles it elegantly. An API platform that charges $0.001 per request, a storage service that charges $0.02 per gigabyte-month, a communication platform that charges $0.0075 per SMS—these are natural fits. You report usage throughout the period, Stripe bills at the end, and the complexity of aggregation and invoice generation is entirely offloaded.

If you're implementing soft limits with overage charges, Stripe also works well. "Your plan includes 1000 API calls. Beyond that, each call costs $0.01." You report all usage to Stripe. Stripe's tiered pricing handles the "first 1000 free, then $0.01 each" calculation automatically.

The prepaid credit model is different because it requires hard enforcement. The user isn't allowed to exceed their balance and pay for the overage later. They're stopped at the limit. That stopping must happen in your application, at request time, before any usage is reported anywhere.

---

## A Hybrid for Analytics

One reasonable middle ground is to report usage to Stripe purely for analytics purposes, while still enforcing limits locally. After your application decrements a credit and performs an action, you also fire off a meter event to Stripe:

```
stripe.billing.meterEvents.create({
  event_name: 'credit_used',
  payload: { stripe_customer_id: customer_id }
})
```

This doesn't affect billing—your subscriptions are still flat-rate. But it populates Stripe's usage dashboards, giving you visibility into consumption patterns without building a separate analytics pipeline. You can see which customers are heavy users, identify who might be ready for an upsell to a higher tier, and spot unusual usage patterns.

This is additive, not instead of. Your application still maintains the credit balance and enforces the limits. Stripe just gets a copy of the events for reporting.

---

## Conclusion

The architecture where Stripe handles billing and your application handles credits isn't a compromise or a workaround. It's the correct separation of concerns. Stripe is purpose-built for the complexity of payment processing—card networks, retries, compliance, invoicing, dunning. Your application is purpose-built for the complexity of your business logic—what a subscription means, how credits work, when users should be blocked.

Attempting to force credit enforcement into Stripe's domain would mean either changing your product model to something Stripe natively supports (post-paid usage billing), or building fragile workarounds using metadata and API calls that duplicate what a simple database does better.

The webhook-based integration described in the spec is the standard pattern for this type of system. Stripe sends events when billing things happen. Your app updates its state accordingly. Your app enforces its own rules about what users can do. Both systems do what they're good at.
