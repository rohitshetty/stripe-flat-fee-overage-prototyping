# Custom Entitlement Implementation

Documentation for the traditional approach where your application manages credits/entitlements locally, with Stripe handling payments only.

## Contents

### Architecture & Design

| Document | Description |
|----------|-------------|
| [Why Your App Must Handle Credits, Not Stripe](./why-app-handles-credits-not-stripe.md) | Explains why Stripe is a billing system, not an entitlement system. Covers the prepaid vs post-paid distinction. |
| [The Dance Between Stripe and Your Application](./how-stripe-and-custom-code-work-together.md) | A narrative essay on how the system works end-to-end—webhooks, credit allocation, consumption logic, renewals, and tradeoffs. |
| [Stripe Credits vs. Local Credits](./stripe-credits-vs-local-credits.md) | Deep comparison of Stripe's native Credits feature vs. our local implementation. |
| [Implementing a Credit-Based Subscription System](./stripe-credits-implementation-notes.md) | A practical implementation guide with code snippets, gotchas, and CLI testing commands. |

### Edge Cases & Scenarios

| Document | Description |
|----------|-------------|
| [The Corner Cases That Will Break Your Subscription System](./subscription-corner-cases.md) | Catalogs 10 edge cases: cancellation timing, upgrade proration, failed payments, renewal gaps, trial expiration, and more. |

## Key Files

- [`lib/credits.ts`](../../lib/credits.ts) — Credit consumption, allocation, expiration (~258 lines)
- [`lib/subscriptions.ts`](../../lib/subscriptions.ts) — Subscription state management
- [`app/api/webhooks/stripe/route.ts`](../../app/api/webhooks/stripe/route.ts) — Webhook handler (~187 lines)
- [`lib/constants.ts`](../../lib/constants.ts) — Tier definitions, price ID mappings

## Core Insight

Stripe handles money (payments, subscriptions, invoices). Your app handles meaning (what a payment means in credits, when users can act, expiration rules).

The bridge is webhooks. Stripe sends events like `invoice.paid`, your app translates them into credit operations.
