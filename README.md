# Subscription Prototype

A Next.js prototype exploring two different Stripe integration patterns for subscription billing:

1. **Custom Entitlement** — Prepaid credits managed locally, Stripe handles payments only
2. **Stripe Native** — Post-paid usage billing with Stripe Meters handling everything

## Quick Comparison

| Aspect | Custom Entitlement | Stripe Native |
|--------|-------------------|---------------|
| **Model** | Prepaid (credits) | Post-paid (usage) |
| **Blocking** | Users blocked at 0 credits | Never blocked |
| **Overages** | Require addon purchase | Automatic, billed at cycle end |
| **Complexity** | ~700 lines | ~400 lines |
| **Source of Truth** | Local database | Stripe Meters |

---

## 1. General Setup

### Prerequisites

- Node.js 18+
- Stripe account with test mode enabled
- Stripe CLI (for webhook testing)

### Installation

```bash
# Clone and install
git clone <repo-url>
cd subscription-prototype
npm install

# Copy environment template
cp .env.example .env.local
```

### Configure Stripe API Keys

Get your keys from [Stripe Dashboard → API Keys](https://dashboard.stripe.com/test/apikeys):

```env
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Start Development Server 
Needs to be restart after every update to .env.local

```bash
npm run dev
```

Open http://localhost:3000

---

## 2. Custom Entitlement Flow (Credits)

Users receive a monthly credit allocation. When credits hit zero, they're blocked until they purchase addon packs or wait for renewal.

**URL:** http://localhost:3000

### Setup

#### Step 1: Initialize Database

```bash
npm run db:init
```

This creates `data/prototype.db` with:
- `users` — User accounts
- `subscriptions` — Subscription state
- `credits` — Credit balances (subscription vs addon)
- `credit_log` — Audit trail
- `addon_purchases` — One-time purchases

#### Step 2: Create Stripe Products

```bash
npm run stripe:setup
```

This creates subscription tiers and addon packs in Stripe. Copy the output price IDs to `.env.local`:

```env
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_EXPERT_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ADDON_SMALL_PRICE_ID=price_...
STRIPE_ADDON_MEDIUM_PRICE_ID=price_...
STRIPE_ADDON_LARGE_PRICE_ID=price_...
```

#### Step 3: Set Up Webhooks

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook secret to `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Testing

#### Via UI

1. Go to http://localhost:3000
2. Click "Subscription" to view tiers
3. Start a trial or subscribe
4. Use the "Perform Action" button to consume credits
5. When credits hit 0, purchase addon packs


#### Test Cards

| Card | Behavior |
|------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0341` | Decline |
| `4000 0000 0000 3220` | Requires 3DS |

### Subscription Tiers

| Tier | Monthly | Credits |
|------|---------|---------|
| Starter | $10 | 1 |
| Expert | $15 | 5 |
| Pro | $20 | 10 |

### Addon Packs

| Pack | Price | Credits |
|------|-------|---------|
| Small | $25 | 3 |
| Medium | $70 | 10 |
| Large | $150 | 25 |

### Key Files

```
app/
├── page.tsx                      # Dashboard
├── subscription/page.tsx         # Tier selection
├── api/
│   ├── webhooks/stripe/route.ts  # Webhook handler (~187 lines)
│   ├── checkout/                 # Stripe Checkout
│   └── status/route.ts           # Get current status
lib/
├── credits.ts                    # Credit operations (~258 lines)
├── subscriptions.ts              # Subscription management
└── db.ts                         # Database queries
```

---

## 3. Stripe Native Flow (Usage-Based)

Users are never blocked. Actions are tracked via Stripe Meters and overages are billed automatically at cycle end.

**URL:** http://localhost:3000/native

### Setup

#### Step 1: Initialize Native Database

```bash
npm run db:init-native
```

This creates native tables in `data/prototype.db`:
- `native_users` — User accounts
- `native_subscriptions` — Subscription state (minimal)
- `native_action_log` — Local log (UI only, not for billing)

#### Step 2: Create Stripe Meter

Go to [Stripe Dashboard → Billing → Meters](https://dashboard.stripe.com/test/billing/meters) and create a meter:

- **Event name:** `action_performed`
- **Aggregation:** Sum
- **Customer field:** `stripe_customer_id`

Copy the Meter ID to `.env.local`:

```env
STRIPE_METER_ID=mtr_...
```

#### Step 3: Create Stripe Products

```bash
npm run stripe:setup-native
```

This creates products with **two prices per tier**:
- **License price** — Flat monthly fee
- **Usage price** — Tiered metered pricing (first N at $0, then $X/each)

Copy the output price IDs to `.env.local`:

```env
STRIPE_NATIVE_STARTER_LICENSE_PRICE_ID=price_...
STRIPE_NATIVE_STARTER_USAGE_PRICE_ID=price_...
STRIPE_NATIVE_EXPERT_LICENSE_PRICE_ID=price_...
STRIPE_NATIVE_EXPERT_USAGE_PRICE_ID=price_...
STRIPE_NATIVE_PRO_LICENSE_PRICE_ID=price_...
STRIPE_NATIVE_PRO_USAGE_PRICE_ID=price_...
```

#### Step 4: Set Up Webhooks

In a separate terminal (use a different port if running both):

```bash
stripe listen --forward-to localhost:3000/api/native/webhooks/stripe
```

Copy the webhook secret to `.env.local`:

```env
STRIPE_NATIVE_WEBHOOK_SECRET=whsec_...
```

### Testing

#### Via UI

1. Go to http://localhost:3000/native
2. Click "Subscription" to view tiers
3. Subscribe to a tier (with or without trial)
4. Use the "Perform Action" button — notice you're never blocked
5. Watch usage count update (synced from Stripe)
6. Go to Subscription page to upgrade/downgrade

#### Verify in Stripe Dashboard

1. **Meters:** Dashboard → Billing → Meters → Click your meter → View events
2. **Subscriptions:** Dashboard → Customers → Select customer → View subscription
3. **Invoices:** See upcoming invoice with usage line items

#### Reset Database

```bash
npm run db:init-native
```

This resets the native tables with a new random email, creating a fresh Stripe customer on next subscription.

### Subscription Tiers

| Tier | License Fee | Included Actions | Overage Rate |
|------|-------------|------------------|--------------|
| Starter | $10/mo | 1 | $8/action |
| Expert | $15/mo | 5 | $6/action |
| Pro | $20/mo | 10 | $4/action |

### Key Files

```
app/native/
├── page.tsx                      # Dashboard
├── subscription/page.tsx         # Tier selection + upgrade/downgrade
├── history/page.tsx              # Action history
app/api/native/
├── webhooks/stripe/route.ts      # Webhook handler (~70 lines)
├── action/route.ts               # Record meter event
├── status/route.ts               # Get status from Stripe
├── subscription/change/route.ts  # Upgrade/downgrade
└── checkout/subscription/route.ts
lib/native/
├── meter.ts                      # Stripe Meter integration (~50 lines)
├── db.ts                         # Database queries (~60 lines)
└── constants.ts                  # Tier definitions
```

---

---

## Documentation

See the `learnings/` directory for in-depth architecture documentation:

- **[Custom Entitlement](./learnings/custom-entitlement/)** — Why apps must handle credits, edge cases, implementation notes
- **[Stripe Native](./learnings/stripe-native/)** — Architecture essay on usage-based billing with Stripe Meters

---

## Troubleshooting

### Webhooks not working

1. Ensure `stripe listen` is running
2. Check the webhook secret matches in `.env.local`
3. Check terminal output for errors

### Usage not updating in Native

Stripe Meters have an aggregation delay (seconds to minutes). The UI shows "Synced at HH:MM:SS" to indicate when data was last fetched.

### Database reset

```bash
# Reset credits implementation
npm run db:init

# Reset native implementation (creates new random email)
npm run db:init-native

# Reset both
npm run db:init-all
```

### Price IDs not found

Run the setup scripts again:

```bash
npm run stripe:setup         # For credits
npm run stripe:setup-native  # For native
```
