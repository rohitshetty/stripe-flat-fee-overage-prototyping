# Learnings

Documentation and essays exploring the architecture, tradeoffs, and edge cases of building a credit-based subscription system with Stripe.

## Contents

### Architecture & Design

| Document | Description |
|----------|-------------|
| [Why Your App Must Handle Credits, Not Stripe](./why-app-handles-credits-not-stripe.md) | Explains why Stripe is a billing system, not an entitlement system. Covers the prepaid vs post-paid distinction, what Stripe's features actually do, and why credit enforcement must live in your application. |
| [The Dance Between Stripe and Your Application](./how-stripe-and-custom-code-work-together.md) | A narrative essay (Dan Shipper style) on how the system works end-to-end—webhooks, credit allocation, consumption logic, renewals, and the tradeoffs we made. |
| [Implementing a Credit-Based Subscription System](./stripe-credits-implementation-notes.md) | A practical implementation guide (Simon Willison style) with code snippets, gotchas encountered, CLI testing commands, and production considerations. |

### Edge Cases & Scenarios

| Document | Description |
|----------|-------------|
| [The Corner Cases That Will Break Your Subscription System](./subscription-corner-cases.md) | Catalogs 10 edge cases that trip up most implementations: cancellation timing, upgrade proration, failed payments, renewal gaps, trial expiration, and more. Each with concrete examples and solutions. |

## Quick Reference

**The core insight:** Stripe handles money (payments, subscriptions, invoices). Your app handles meaning (what a payment means in credits, when users can act, expiration rules).

**The bridge:** Webhooks. Stripe sends events like `invoice.paid`, your app translates them into credit operations.

**Key files:**
- [`lib/credits.ts`](../lib/credits.ts) — Credit consumption, allocation, expiration
- [`lib/subscriptions.ts`](../lib/subscriptions.ts) — Subscription state management
- [`app/api/webhooks/stripe/route.ts`](../app/api/webhooks/stripe/route.ts) — Webhook handler
- [`lib/constants.ts`](../lib/constants.ts) — Tier definitions, price ID mappings
