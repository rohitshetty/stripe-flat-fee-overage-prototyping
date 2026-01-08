# Subscription Prototype

A Next.js prototype for validating Stripe integration patterns for a credit-based subscription system.

## Quick Start

### Prerequisites

- Node.js 18+
- Stripe account with test mode enabled
- Stripe CLI (for webhook testing)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Initialize database**
   ```bash
   npm run db:init
   ```

3. **Configure Stripe**

   Create a `.env.local` file:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

4. **Create Stripe products** (one-time)
   ```bash
   npm run stripe:setup
   ```

   Copy the output price IDs to your `.env.local`:
   ```env
   STRIPE_STARTER_PRICE_ID=price_...
   STRIPE_EXPERT_PRICE_ID=price_...
   STRIPE_PRO_PRICE_ID=price_...
   STRIPE_ADDON_SMALL_PRICE_ID=price_...
   STRIPE_ADDON_MEDIUM_PRICE_ID=price_...
   STRIPE_ADDON_LARGE_PRICE_ID=price_...
   ```

5. **Start webhook forwarding** (in a separate terminal)
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   Copy the webhook secret to `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open** http://localhost:3000

## CLI Testing Tools

Test scenarios without Stripe:

```bash
# Show current state
npm run cli status

# Reset to clean state
npm run cli reset

# Set subscription to Pro with 10 credits
npm run cli set-subscription pro active

# Add addon credits
npm run cli add-addon-credits 5

# View event history
npm run cli list-events
```

## Subscription Tiers

| Tier | Monthly | Credits |
|------|---------|---------|
| Starter | $10 | 1 |
| Expert | $15 | 5 |
| Pro | $20 | 10 |

## Add-on Credit Packs

| Pack | Price | Credits |
|------|-------|---------|
| Small | $25 | 3 |
| Medium | $70 | 10 |
| Large | $150 | 25 |

## Project Structure

```
subscription-prototype/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── subscription/      # Subscription management page
│   └── history/           # Activity history page
├── components/            # React components
├── lib/                   # Core business logic
│   ├── db.ts             # SQLite database
│   ├── stripe.ts         # Stripe client
│   ├── credits.ts        # Credit operations
│   └── subscriptions.ts  # Subscription management
├── scripts/              # Setup scripts
└── cli/                  # CLI testing tools
```

## Testing Checklist

- [ ] User can start 14-day trial
- [ ] User can subscribe via Stripe Checkout
- [ ] Credits allocated on subscription
- [ ] Action button consumes credits
- [ ] Subscription credits expire on cycle end
- [ ] Add-on credits persist until used
- [ ] Stripe Customer Portal works
- [ ] Webhooks process correctly

See [SPEC.md](./SPEC.md) for full specification.
