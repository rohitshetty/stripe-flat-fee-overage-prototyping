# Subscription Prototype Specification

A Next.js prototype to validate Stripe integration patterns for a credit-based subscription system using Stripe Checkout and Customer Portal.

## Project Goals

1. **Validate Stripe Offloading**: Determine what Stripe handles natively vs what requires custom code
2. **Credit Sync Accuracy**: Ensure local credit state stays synchronized with Stripe billing events
3. **Upgrade/Downgrade Flows**: Understand how proration and plan changes work in practice
4. **Webhook Reliability**: Handle webhook edge cases and ensure nothing is missed
5. **End-to-End UX**: Complete flow from trial to paid to usage to add-ons

---

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Next.js 14+ (App Router) | Modern patterns, Server Components |
| Database | SQLite | Simple, no setup, portable |
| ORM | None (raw SQL) | Human-readable, educational |
| Styling | Tailwind CSS | Quick, clean UI |
| Payments | Stripe Checkout + Customer Portal | Managed UI, minimal custom code |
| Testing | CLI tools | Separate from user-facing UI |

---

## Subscription Tiers

| Tier | Monthly Price | Credits/Month |
|------|---------------|---------------|
| Starter | $10 | 1 |
| Expert | $15 | 5 |
| Pro | $20 | 10 |

### Credit Rules

- **Expiration**: Subscription credits expire at the end of each billing cycle
- **Rollover**: No rollover - fresh allocation each cycle
- **Consumption Order**: Subscription credits consumed first (since they expire), then add-on credits

---

## Add-on Credit Packs (One-Time Purchase)

| Pack | Price | Credits | Unit Cost |
|------|-------|---------|-----------|
| Small | $25 | 3 | $8.33 |
| Medium | $70 | 10 | $7.00 |
| Large | $150 | 25 | $6.00 |

### Add-on Rules

- **Expiration**: Add-on credits never expire
- **Availability**: Can purchase anytime (not just at zero balance)
- **Stacking**: Unlimited - buy as many packs as desired, credits accumulate
- **Subscription Required**: Must have active subscription to purchase or use add-ons

---

## Trial Period

| Setting | Value |
|---------|-------|
| Duration | 14 days |
| Tier Level | Starter (1 credit) |
| Payment Required | No (card not required upfront) |
| Conversion | Explicit action required at trial end |
| Re-trial | Never - trial is once per user, ever |

---

## Billing Behavior

### Billing Cycle
- **Anchor**: Subscription start date (user subscribes on 15th, billed on 15th each month)
- **Managed By**: Stripe (use default anniversary billing)

### Failed Payment Handling
- **Grace Period**: 7 days
- **Retry Behavior**: Let Stripe handle automatic retries
- **User Experience During Grace**:
  - Warning banner displayed
  - Can use remaining credits
  - Cannot purchase add-ons
  - Limited UI functionality

### Cancellation (Two-Phase Process)

**Phase 1 - User initiates cancellation:**
- **Stripe Event**: `customer.subscription.updated` with `cancel_at_period_end: true`
- **Refund Policy**: No refund
- **Access**: User keeps remaining credits and full access until billing cycle ends
- **UI**: Show "Subscription cancels on [date]" message

**Phase 2 - Billing period ends:**
- **Stripe Event**: `customer.subscription.deleted`
- **Credit Handling**: Remaining subscription credits are expired (set to 0, logged)
- **Add-on Credits**: Preserved but unusable (subscription required to use)
- **Status**: Subscription marked as `canceled`

---

## Upgrade/Downgrade Behavior

### Upgrade (e.g., Starter → Pro)
- **Credit Handling**: Prorated difference added to existing balance
  - Example: User has 0 credits on Starter, upgrades to Pro mid-cycle
  - Gets (10 - 1) = 9 additional credits immediately
- **Billing**: Stripe handles proration automatically

### Downgrade (e.g., Pro → Starter)
- **Credit Handling**: Keep all existing credits until depleted
- **New Allocation**: Lower tier allocation starts at next billing cycle
- **Billing**: Takes effect at end of current period (no immediate proration)

---

## Webhook & State Synchronization

### Strategy: Hybrid Approach
1. **Trust Webhooks**: Primary source of billing events
2. **Check Stripe on Critical Actions**: Query Stripe API when:
   - User attempts to use credits
   - User views subscription status
   - Near billing cycle boundaries (renewal gap scenario)

### Renewal Gap Handling
- If user tries to perform action when credits are 0 and it's past renewal date but webhook not yet received:
  - Query Stripe API in real-time to confirm renewal status
  - If renewed, allocate credits and allow action
  - If not renewed, block action

### Stripe Test Clocks Integration
- Use Stripe Test Clocks API for time-based testing
- Enables realistic simulation of:
  - Billing cycle progression
  - Trial expiration
  - Subscription renewals
  - Failed payment scenarios

---

## User Interface

### Design Philosophy
- **Style**: Minimal and clean
- **Colors**: Limited palette, functional use of color
- **Spacing**: Generous whitespace
- **Focus**: Functionality over decoration

### Page Structure (2-3 pages)

#### 1. Dashboard (Main Page)
Primary user interaction surface.

**Displays:**
- Current credit balance (subscription credits + add-on credits breakdown)
- Current subscription tier with status badge
- Days until next renewal
- Next billing date
- Credit usage this cycle
- Action button (the "click here" feature)
- Quick link to manage subscription
- Recent activity (last 5 events)

**Action Button:**
- Visible counter showing total "actions" performed
- Each click consumes 1 credit
- Disabled when credits = 0
- Client-side throttle to prevent spam

**Low Credit Warning:**
- Active notification (dismissible banner/toast)
- Appears when credits ≤ 2 remaining

#### 2. Subscription Management Page
- Current plan details
- Upgrade/downgrade options (links to Stripe Customer Portal)
- Add-on credit pack purchase buttons
- Trial status (if applicable)

**Plan Changes:**
- Redirect to Stripe Customer Portal for all subscription management
- Use Stripe's managed UI for:
  - Plan upgrades/downgrades
  - Payment method updates
  - Cancellation
  - Invoice history

#### 3. History Page
Activity log showing:
- Credit consumption events (timestamp, balance before/after)
- Subscription changes (upgrades, downgrades, cancellations)
- Payment events (successful charges, failed attempts)
- Renewal events

**Not included (available via Stripe Portal):**
- Detailed invoices
- Full billing history
- Payment receipts

### Post-Checkout Flow
- Redirect back to dashboard after Stripe Checkout
- Display success toast/banner based on query parameter
- Refresh subscription state from Stripe

### Error Handling
- **Action errors**: Inline error message near the failed action
- **System/background errors**: Toast notification (auto-dismiss)

### Grace Period UI
- Warning banner at top of dashboard
- "Update payment method" CTA button
- Action button still functional (if credits remain)
- Add-on purchase disabled
- Visual indication of limited state

---

## Backend Architecture

### Database Schema (SQLite)

```sql
-- Single user for prototype (no auth)
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL DEFAULT 'test@example.com',
    stripe_customer_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subscription state (source of truth: Stripe, cached locally)
CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stripe_subscription_id TEXT,
    tier TEXT NOT NULL, -- 'starter', 'expert', 'pro'
    status TEXT NOT NULL, -- 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    trial_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Credit balances (separate tracking for subscription vs add-on)
CREATE TABLE credits (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    subscription_credits INTEGER DEFAULT 0,
    addon_credits INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Audit log for credits and billing events
CREATE TABLE credit_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- 'usage', 'subscription_renewal', 'addon_purchase', 'subscription_change', 'payment_failed', 'payment_succeeded', 'trial_started', 'trial_ended', 'credits_expired'
    credits_change INTEGER, -- positive for additions, negative for usage
    credit_type TEXT, -- 'subscription' or 'addon'
    balance_before INTEGER,
    balance_after INTEGER,
    description TEXT,
    stripe_event_id TEXT, -- for deduplication
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Action counter (the visible counter for "clicks")
CREATE TABLE actions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/status` | Get current user status, credits, subscription |
| POST | `/api/credits/use` | Consume 1 credit, increment action counter |
| POST | `/api/checkout/subscription` | Create Stripe Checkout session for subscription |
| POST | `/api/checkout/addon` | Create Stripe Checkout session for add-on pack |
| POST | `/api/webhooks/stripe` | Handle Stripe webhook events |
| GET | `/api/portal` | Get Stripe Customer Portal URL |
| GET | `/api/history` | Get credit and billing history |

### Webhook Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update subscription, allocate credits |
| `customer.subscription.created` | Initialize subscription record |
| `customer.subscription.updated` | Update tier, status, handle upgrades/downgrades, track `cancel_at_period_end` |
| `customer.subscription.deleted` | Expire remaining subscription credits, mark subscription canceled |
| `invoice.paid` | Allocate subscription credits for new period (expires previous balance first) |
| `invoice.payment_failed` | Update status to past_due, log event |
| `customer.subscription.trial_will_end` | (Optional) Send notification |

### Credit Consumption Logic

```
function useCredit(userId):
    1. Acquire lock for user (prevent race conditions)
    2. Get current subscription status
       - If no active subscription: reject
       - If past_due but within grace period: allow if credits > 0
    3. Check Stripe API if near renewal boundary (hybrid sync)
    4. Get credit balance
       - If subscription_credits > 0: decrement subscription_credits
       - Else if addon_credits > 0: decrement addon_credits
       - Else: reject (no credits)
    5. Increment action counter
    6. Log event to credit_log
    7. Release lock
    8. Return new balance and action count
```

### Renewal Credit Allocation Logic

```
function onInvoicePaid(event):
    1. Check if event already processed (idempotency via stripe_event_id)
    2. Get subscription tier from event metadata
    3. Expire remaining subscription credits (log as 'credits_expired')
    4. Allocate new credits based on tier:
       - Starter: 1
       - Expert: 5
       - Pro: 10
    5. Log event as 'subscription_renewal'
```

### Upgrade Credit Calculation

```
function onSubscriptionUpgraded(oldTier, newTier):
    oldCredits = getTierCredits(oldTier)  // 1, 5, or 10
    newCredits = getTierCredits(newTier)
    difference = newCredits - oldCredits

    if difference > 0:
        addSubscriptionCredits(difference)
        logEvent('subscription_change', difference)
```

### Credit Expiration Logic

Credits expire in two scenarios: subscription renewal and subscription termination.

#### On Subscription Renewal (webhook: `invoice.paid`)

When a new billing cycle begins, any remaining subscription credits from the previous cycle are expired before allocating fresh credits.

```
function onInvoicePaid(event):
    1. Check idempotency (skip if stripe_event_id already processed)
    2. Get current subscription_credits balance
    3. If subscription_credits > 0:
       - Log event: 'credits_expired', change: -subscription_credits
       - Set subscription_credits = 0
    4. Allocate new credits based on tier
    5. Log event: 'subscription_renewal', change: +newCredits
```

#### On Subscription Cancellation

Cancellation is a two-phase process:

**Phase 1: User clicks "Cancel" (webhook: `customer.subscription.updated`)**
```
function onSubscriptionUpdated(event):
    if event.cancel_at_period_end == true:
        - Update local record: cancel_at_period_end = true
        - Log event: 'subscription_cancel_scheduled'
        - User KEEPS remaining credits
        - User can continue using credits until period ends
```

**Phase 2: Period ends (webhook: `customer.subscription.deleted`)**
```
function onSubscriptionDeleted(event):
    1. Check idempotency (skip if stripe_event_id already processed)
    2. Get current subscription_credits balance
    3. If subscription_credits > 0:
       - Log event: 'credits_expired', change: -subscription_credits
       - Description: 'Subscription ended, credits expired'
       - Set subscription_credits = 0
    4. Update subscription status = 'canceled'
    5. Note: addon_credits are NOT affected (they never expire)
```

#### Timeline Example: Mid-Cycle Cancellation

```
Day 1 (Jan 15):   User subscribes to Expert plan
                  → subscription_credits = 5, addon_credits = 0

Day 5 (Jan 20):   User purchases Small add-on pack
                  → subscription_credits = 5, addon_credits = 3

Day 10 (Jan 25):  User uses 3 credits (subscription first)
                  → subscription_credits = 2, addon_credits = 3

Day 10 (Jan 25):  User clicks "Cancel subscription"
                  → Webhook: subscription.updated (cancel_at_period_end: true)
                  → subscription_credits = 2, addon_credits = 3 (unchanged)
                  → User can still use remaining credits

Day 15 (Jan 30):  User uses 2 more credits
                  → subscription_credits = 0, addon_credits = 3

Day 30 (Feb 15):  Billing period ends
                  → Webhook: subscription.deleted
                  → subscription_credits = 0 (already 0, nothing to expire)
                  → addon_credits = 3 (preserved, never expire)
                  → Status: 'canceled'
                  → User cannot use addon_credits (subscription required)
```

#### Key Points

1. **Subscription credits expire on cycle boundaries** - whether renewal or termination
2. **Add-on credits never expire** - but require active subscription to use
3. **Cancellation doesn't immediately revoke access** - user keeps credits until period ends
4. **Always log expirations** - audit trail shows what was lost and when

---

## CLI Testing Tools

Full simulation CLI for testing scenarios. Run via `npm run cli <command>`.

### Commands

| Command | Description |
|---------|-------------|
| `status` | Show current user state, credits, subscription |
| `reset` | Wipe all data, reinitialize single test user |
| `set-credits <sub> <addon>` | Manually set credit balances |
| `set-subscription <tier> <status>` | Set subscription tier and status |
| `set-trial-end <iso-date>` | Set trial end date |
| `add-addon-credits <amount>` | Add addon credits directly |
| `simulate-webhook <event-type>` | Trigger webhook handler with mock event |
| `simulate-payment-failed` | Simulate failed payment, set past_due status |
| `advance-time <days>` | Advance Stripe Test Clock by N days |
| `trigger-billing` | Trigger billing cycle via Test Clock |
| `list-events` | Show credit_log entries |
| `clear-events` | Clear credit_log |

### Test Clock Integration

```bash
# Create test clock for user
npm run cli create-test-clock

# Advance time to trigger renewal
npm run cli advance-time 30

# Advance time to end trial
npm run cli advance-time 14
```

---

## Stripe vs Custom Code Breakdown

### Stripe Handles (Zero Custom Code)

| Feature | Stripe Component |
|---------|------------------|
| Payment collection | Stripe Checkout |
| Payment method management | Customer Portal |
| Subscription billing | Billing engine |
| Proration calculations | Automatic |
| Invoice generation | Automatic |
| Invoice history | Customer Portal |
| Failed payment retries | Smart Retries |
| Receipt emails | Automatic |
| Tax calculation | Stripe Tax (optional) |
| Plan upgrade/downgrade UI | Customer Portal |
| Cancellation flow | Customer Portal |
| PCI compliance | Stripe handles all card data |

### Custom Code Required

| Feature | Why Custom |
|---------|------------|
| Credit balance tracking | Business logic (credits ≠ subscription) |
| Credit consumption | App-specific action |
| Credit allocation on renewal | Business rules (tier → credits) |
| Add-on credit tracking | Separate from subscription |
| Usage audit log | App requirement |
| Action counter | App feature |
| Low credit notifications | UX requirement |
| Grace period UI restrictions | Business rule |
| Webhook processing | State synchronization |
| Trial-to-paid conversion check | Business logic |
| Subscription-required enforcement | Business rule |

### Shared Responsibility

| Feature | Stripe | Custom |
|---------|--------|--------|
| Subscription status | Source of truth | Cached locally for display |
| Upgrade proration | Calculates amount | Calculates credit difference |
| Failed payments | Retries, status | UI restrictions, notifications |
| Cancellation | Processes request | Enforces `cancel_at_period_end` |

---

## Logging & Monitoring

### What to Log

**Always Log:**
- All webhook events received (event type, ID, timestamp)
- All credit operations (type, amount, balance before/after)
- API errors (endpoint, error message, stack trace)
- Stripe API calls (endpoint, params, response status)

**Log Format:**
```
[TIMESTAMP] [LEVEL] [COMPONENT] message {metadata}
```

**Example:**
```
[2024-01-15T10:30:00Z] [INFO] [webhook] Received event {type: "invoice.paid", id: "evt_xxx"}
[2024-01-15T10:30:01Z] [INFO] [credits] Allocated credits {user: 1, amount: 5, type: "subscription", balance: 5}
[2024-01-15T10:30:02Z] [ERROR] [stripe-api] API call failed {endpoint: "/v1/subscriptions", error: "rate_limited"}
```

### Database Logging

The `credit_log` table serves as the audit trail. For prototype, console logging is sufficient for debugging.

### Production Considerations (Document Only)

For production, recommend:
- Structured logging (JSON format)
- Log aggregation service (Datadog, Logtail, etc.)
- Webhook event queue for reliability
- Idempotency keys for all Stripe API calls
- Monitoring alerts for:
  - Webhook processing failures
  - Credit sync discrepancies
  - High rate of failed payments

---

## File Structure

```
subscription-prototype/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Dashboard
│   ├── subscription/
│   │   └── page.tsx                # Subscription management
│   ├── history/
│   │   └── page.tsx                # Activity history
│   └── api/
│       ├── user/
│       │   └── status/route.ts
│       ├── credits/
│       │   └── use/route.ts
│       ├── checkout/
│       │   ├── subscription/route.ts
│       │   └── addon/route.ts
│       ├── portal/route.ts
│       ├── history/route.ts
│       └── webhooks/
│           └── stripe/route.ts
├── lib/
│   ├── db.ts                       # SQLite connection, raw SQL helpers
│   ├── stripe.ts                   # Stripe client, helpers
│   ├── credits.ts                  # Credit operations
│   ├── subscriptions.ts            # Subscription operations
│   └── constants.ts                # Tier configs, pricing
├── components/
│   ├── CreditDisplay.tsx
│   ├── ActionButton.tsx
│   ├── SubscriptionStatus.tsx
│   ├── AddonPurchase.tsx
│   ├── ActivityLog.tsx
│   ├── Toast.tsx
│   └── GracePeriodBanner.tsx
├── cli/
│   └── index.ts                    # CLI testing tools
├── scripts/
│   └── init-db.ts                  # Database initialization
├── STRIPE_SETUP.md                 # Stripe configuration guide
├── SPEC.md                         # This file
├── package.json
└── README.md
```

---

## Setup Requirements

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_EXPERT_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ADDON_SMALL_PRICE_ID=price_...
STRIPE_ADDON_MEDIUM_PRICE_ID=price_...
STRIPE_ADDON_LARGE_PRICE_ID=price_...
DATABASE_PATH=./data/prototype.db
```

### Stripe Products to Create

1. **Subscription Products** (recurring monthly):
   - Starter Plan - $10/month
   - Expert Plan - $15/month
   - Pro Plan - $20/month

2. **Add-on Products** (one-time):
   - Small Credit Pack - $25
   - Medium Credit Pack - $70
   - Large Credit Pack - $150

### Local Development

```bash
# Install dependencies
npm install

# Initialize database
npm run db:init

# Start Stripe webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Start development server
npm run dev

# In another terminal, use CLI tools
npm run cli status
npm run cli reset
```

---

## Edge Cases Summary

| Scenario | Behavior |
|----------|----------|
| User spam-clicks action button | Client throttle + server atomic lock |
| Webhook delayed/missed | Check Stripe API on critical actions |
| Renewal webhook not yet received | Query Stripe API if action attempted post-renewal date |
| User cancels mid-cycle | `cancel_at_period_end=true`, keep credits until period ends |
| Subscription period ends after cancel | `subscription.deleted` webhook expires remaining subscription credits |
| Cancelled user with remaining addon credits | Credits preserved but unusable (subscription required) |
| Failed payment | 7-day grace period, limited UI, can use remaining credits |
| Upgrade mid-cycle | Prorated credit difference added immediately |
| Downgrade mid-cycle | Keep credits, new allocation next cycle |
| Renewal with unused credits | Old subscription credits expired, fresh allocation granted |
| Trial ends | Subscription pauses, requires explicit action to continue |
| Trial ends with credits remaining | Subscription credits expired on `subscription.deleted` |
| User with cancelled sub tries to buy addon | Rejected - subscription required |
| User exhausts all credits | Shows zero, action disabled, can buy addon if subscribed |
| Simultaneous webhook + user action | Server-side lock ensures consistency |

---

## Success Criteria

The prototype is successful if it demonstrates:

1. [ ] User can start 14-day trial without payment method
2. [ ] User can subscribe via Stripe Checkout
3. [ ] Credits are allocated on subscription/renewal
4. [ ] Action button correctly consumes credits
5. [ ] Credit balance updates in real-time
6. [ ] Subscription credits expire on cycle end
7. [ ] Add-on credits persist until used
8. [ ] Upgrade gives prorated credit difference
9. [ ] Downgrade preserves existing credits
10. [ ] Add-on purchase works (one-time)
11. [ ] Stripe Customer Portal accessible for management
12. [ ] Webhook events properly processed
13. [ ] Grace period restrictions enforced
14. [ ] CLI tools enable scenario testing
15. [ ] Test Clock integration works for time simulation
16. [ ] Audit log captures all credit/billing events
