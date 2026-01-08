# Stripe Native Implementation

Documentation for the Stripe-native approach where Stripe handles everything through Meters and usage-based billing.

## Contents

| Document | Description |
|----------|-------------|
| [The Elegant Simplicity of Letting Stripe Do Its Job](./the-elegant-simplicity-of-letting-stripe-do-its-job.md) | Comprehensive essay covering architecture, user scenarios, implementation details, corner cases, and tradeoffs. |

## Key Files

- [`lib/native/meter.ts`](../../lib/native/meter.ts) — Stripe Meter integration (~50 lines)
- [`lib/native/db.ts`](../../lib/native/db.ts) — Database queries (~60 lines)
- [`lib/native/constants.ts`](../../lib/native/constants.ts) — Tier definitions (~90 lines)
- [`app/api/native/action/route.ts`](../../app/api/native/action/route.ts) — Action endpoint
- [`app/api/native/webhooks/stripe/route.ts`](../../app/api/native/webhooks/stripe/route.ts) — Webhook handler (~70 lines)

## Core Insight

Instead of tracking credits locally and syncing with Stripe, send usage events to Stripe Meters and let Stripe handle aggregation, billing, and period resets.

**Total backend code: ~400 lines** (vs ~700+ for custom entitlement)

## Model Comparison

| Aspect | Stripe Native |
|--------|---------------|
| Billing model | Post-paid (charge after usage) |
| User blocking | Never blocked |
| Overages | Automatic, billed at cycle end |
| Source of truth | Stripe Meters |
| Credit purchases | Not supported (use tier upgrades) |
| Rollover | Not supported (usage resets each period) |
