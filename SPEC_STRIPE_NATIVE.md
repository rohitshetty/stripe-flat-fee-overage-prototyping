# Subscription Prototype Specification - Stripe Native (Flat Fee + Overages)

A Next.js prototype to validate Stripe's **native usage-based billing** with the flat fee + overages model. This implementation offloads credit tracking entirely to Stripe, contrasting with the custom credit tracking in SPEC.md.

> **Purpose**: Compare implementation complexity between local credit management (SPEC.md) vs Stripe-native metered billing (this spec).

---

## Key Difference: Post-Pay vs Pre-Pay

| Aspect | SPEC.md (Local Credits) | This Spec (Stripe Native) |
|--------|-------------------------|---------------------------|
| Payment Model | **Pre-pay** - Buy credits upfront | **Post-pay** - Use now, pay at cycle end |
| Credit Tracking | Local SQLite database | Stripe Meters |
| Usage Blocking | Blocked when credits = 0 | Never blocked (pay for overages) |
| Overage Handling | Must buy add-on packs | Automatic overage billing |
| Webhook Complexity | High - sync credits on many events | Low - Stripe handles everything |
| Custom Code | Credit allocation, consumption, expiration | Usage reporting only |

---

## How Flat Fee + Overages Works

Each subscription tier includes:
1. **Flat monthly fee** - Charged at period start
2. **Included usage** - Free tier of actions (billed at $0/action)
3. **Overage rate** - Per-action charge beyond included amount

Stripe handles all billing logic via **Meters** and **Tiered Pricing**.

### Billing Flow

```
User performs action
       ↓
App sends meter event to Stripe
       ↓
Stripe aggregates usage
       ↓
At billing cycle end:
  - Flat fee charged
  - Included usage: $0 × included_actions
  - Overages: $X × (total_actions - included_actions)
       ↓
Invoice generated and charged
```

---

## Subscription Tiers (Mapped to Stripe Tiered Pricing)

| Tier | Monthly Fee | Included Actions | Overage Rate |
|------|-------------|------------------|--------------|
| Starter | $10 | 1 | $8.00/action |
| Expert | $15 | 5 | $6.00/action |
| Pro | $20 | 10 | $4.00/action |

### Stripe Pricing Configuration

Each tier requires **two prices** on a single subscription:

**Price 1: License Fee (Flat)**
- Type: `recurring`
- Billing scheme: `per_unit`
- Amount: $10 / $15 / $20 depending on tier

**Price 2: Usage (Tiered/Graduated)**
- Type: `recurring` with `usage_type: metered`
- Billing scheme: `tiered`
- Tiers mode: `graduated`
- Linked to: Stripe Meter

#### Tiered Pricing Example (Starter - $10/mo, 1 included)

| Tier | Up to | Per Unit |
|------|-------|----------|
| 1 | 1 action | $0.00 |
| 2 | ∞ | $8.00 |

#### Tiered Pricing Example (Expert - $15/mo, 5 included)

| Tier | Up to | Per Unit |
|------|-------|----------|
| 1 | 5 actions | $0.00 |
| 2 | ∞ | $6.00 |

#### Tiered Pricing Example (Pro - $20/mo, 10 included)

| Tier | Up to | Per Unit |
|------|-------|----------|
| 1 | 10 actions | $0.00 |
| 2 | ∞ | $4.00 |

---

## Stripe Meter Configuration

Create a single meter for tracking actions:

```javascript
const meter = await stripe.billing.meters.create({
  display_name: 'Actions',
  event_name: 'action_performed',
  default_aggregation: {
    formula: 'sum'
  },
  customer_mapping: {
    type: 'by_id',
    event_payload_key: 'stripe_customer_id'
  },
  value_settings: {
    event_payload_key: 'value'
  }
});
```

**Meter ID**: Store as `STRIPE_METER_ID` in environment variables.

---

## Trial Period

| Setting | Value |
|---------|-------|
| Duration | 14 days |
| Tier Level | Starter (1 included action) |
| Payment Required | No (card not required upfront) |
| Usage During Trial | Allowed and tracked |
| Overage During Trial | Charged at trial conversion |

> **Note**: Usage during trial accumulates. If user exceeds included actions during trial, overages are charged when they convert to paid.

---

## User Interface

### URL Structure (Separate from SPEC.md Implementation)

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/native/` | Main dashboard with usage tracking |
| Subscription | `/native/subscription` | Plan management |
| History | `/native/history` | Usage and billing history |

### Dashboard (`/native/`)

**Displays:**
- Current subscription tier with status badge
- **Usage this cycle**: Actions used / Included actions (e.g., "7 / 5 actions")
- **Overage count**: Actions beyond included (e.g., "2 overage actions")
- **Estimated overage charge**: Calculated preview (e.g., "~$12.00")
- Days until billing cycle ends
- Action button (never disabled - always available)
- Link to Stripe Customer Portal

**Action Button Behavior:**
- Always enabled (post-pay model)
- Each click sends meter event to Stripe
- Shows running total of actions this cycle
- No blocking - user pays for all usage

**Usage Warning:**
- Shows when user exceeds included actions
- Displays estimated overage amount
- Non-blocking - informational only

### Subscription Management (`/native/subscription`)

- Current plan details with included actions
- Current cycle usage pulled from Stripe
- Upgrade/downgrade options (via Customer Portal)
- **No add-on packs** - overages replace this need

### History Page (`/native/history`)

- Usage events this cycle (from local log)
- Invoice history (from Stripe)
- Overage charges on past invoices

---

## Backend Architecture

### Database Schema (Simplified)

```sql
-- Single user for prototype (no auth)
CREATE TABLE native_users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL DEFAULT 'test@example.com',
    stripe_customer_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subscription state (minimal - Stripe is source of truth)
CREATE TABLE native_subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stripe_subscription_id TEXT,
    tier TEXT NOT NULL, -- 'starter', 'expert', 'pro'
    status TEXT NOT NULL, -- 'trialing', 'active', 'past_due', 'canceled'
    current_period_start DATETIME,
    current_period_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES native_users(id)
);

-- Local action log (for UI responsiveness, NOT billing source of truth)
CREATE TABLE native_action_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stripe_meter_event_id TEXT, -- For correlation
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES native_users(id)
);
```

**Key Difference**: No `credits` table. No `credit_log` table. Stripe handles all usage tracking.

### API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/native/user/status` | Get user status, subscription, current usage from Stripe |
| POST | `/api/native/action` | Perform action (sends meter event to Stripe) |
| POST | `/api/native/checkout/subscription` | Create Stripe Checkout session |
| POST | `/api/native/webhooks/stripe` | Handle Stripe webhook events |
| GET | `/api/native/portal` | Get Stripe Customer Portal URL |
| GET | `/api/native/usage` | Get current cycle usage from Stripe Meter |
| GET | `/api/native/history` | Get action and invoice history |

### Action Endpoint Logic

```javascript
// POST /api/native/action
async function performAction(userId) {
    // 1. Get user's Stripe customer ID
    const user = await getUser(userId);

    // 2. Verify active subscription (optional - could allow usage anyway)
    const subscription = await getSubscription(userId);
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        return { error: 'No active subscription' };
    }

    // 3. Send meter event to Stripe
    const meterEvent = await stripe.billing.meterEvents.create({
        event_name: 'action_performed',
        payload: {
            stripe_customer_id: user.stripe_customer_id,
            value: '1'
        }
    });

    // 4. Log locally for UI (optional)
    await logAction(userId, meterEvent.identifier);

    // 5. Return success (no credit balance to return)
    return {
        success: true,
        meter_event_id: meterEvent.identifier
    };
}
```

**Complexity Comparison:**
- SPEC.md: Lock, check credits, decrement, handle credit type priority, log, unlock
- This spec: Send meter event to Stripe. Done.

### Get Current Usage

```javascript
// GET /api/native/usage
async function getCurrentUsage(userId) {
    const user = await getUser(userId);
    const subscription = await getSubscription(userId);

    // Query Stripe for current period usage
    const meterSummary = await stripe.billing.meters.listEventSummaries(
        STRIPE_METER_ID,
        {
            customer: user.stripe_customer_id,
            start_time: subscription.current_period_start,
            end_time: subscription.current_period_end
        }
    );

    const totalUsage = meterSummary.data[0]?.aggregated_value || 0;
    const includedActions = getTierIncludedActions(subscription.tier);
    const overageCount = Math.max(0, totalUsage - includedActions);
    const overageRate = getTierOverageRate(subscription.tier);

    return {
        total_actions: totalUsage,
        included_actions: includedActions,
        overage_count: overageCount,
        estimated_overage_charge: overageCount * overageRate
    };
}
```

---

## Webhook Events (Minimal)

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription record |
| `customer.subscription.created` | Store subscription ID |
| `customer.subscription.updated` | Update tier/status |
| `customer.subscription.deleted` | Mark subscription canceled |
| `invoice.paid` | Log successful payment (optional) |
| `invoice.payment_failed` | Update status to past_due |
| `v1.billing.meter.error_report_triggered` | Log meter errors |

**Key Difference**: No credit allocation, expiration, or sync logic needed.

### Webhook Handler Comparison

**SPEC.md (Local Credits) - invoice.paid:**
```javascript
async function onInvoicePaid(event) {
    // 1. Check idempotency
    // 2. Get subscription tier
    // 3. Get current subscription credits
    // 4. If credits > 0, log expiration event
    // 5. Set subscription_credits = 0
    // 6. Calculate new credits based on tier
    // 7. Add new credits to balance
    // 8. Log allocation event
    // 9. Update period dates
}
```

**This Spec (Stripe Native) - invoice.paid:**
```javascript
async function onInvoicePaid(event) {
    // 1. Log event (optional, for history page)
    // That's it. Stripe already handled usage billing.
}
```

---

## Upgrade/Downgrade Behavior

### Upgrade (e.g., Starter → Pro)

- **Immediately**: New flat fee prorated, new included tier applies
- **Usage Reset**: Stripe handles mid-cycle tier changes
- **No credit calculation needed** - Stripe recalculates tiers

### Downgrade (e.g., Pro → Starter)

- **End of Period**: Takes effect at next billing cycle
- **Usage Continues**: Current tier's included amount until cycle ends
- **No credit preservation logic needed**

---

## Cancellation Behavior

### User Initiates Cancellation

- **`customer.subscription.updated`** with `cancel_at_period_end: true`
- User can continue using service until period ends
- All usage billed normally

### Period Ends

- **`customer.subscription.deleted`** webhook
- Mark subscription as canceled
- No credit expiration logic needed

---

## Comparison: Stripe Native vs Custom Credits

### Code Complexity

| Component | SPEC.md (Custom) | This Spec (Native) |
|-----------|------------------|-------------------|
| Database Tables | 5 | 3 |
| Credit Logic Functions | ~10 | 0 |
| Webhook Handlers | Complex (credit sync) | Simple (status only) |
| Race Condition Handling | Required (locks) | Not needed |
| Expiration Logic | Custom | None |
| Usage Tracking | Custom | Stripe Meter |

### What Stripe Handles Natively

| Feature | Custom Credits | Stripe Native |
|---------|----------------|---------------|
| Usage counting | ❌ Manual | ✅ Automatic |
| Billing calculation | ❌ Manual | ✅ Automatic |
| Overage pricing | ❌ Manual (add-ons) | ✅ Automatic |
| Period reset | ❌ Manual | ✅ Automatic |
| Proration | ❌ Manual | ✅ Automatic |
| Invoice line items | ❌ N/A | ✅ Detailed breakdown |

### Trade-offs

| Aspect | SPEC.md (Custom) | This Spec (Native) |
|--------|------------------|-------------------|
| User Control | Pre-pay: User controls spend | Post-pay: User pays for all usage |
| Revenue Risk | None (prepaid) | User might dispute charges |
| UX Friction | "No credits" blocking | No blocking, surprise bills possible |
| Add-on Sales | Upsell opportunity | No add-on concept |
| Flexibility | High (custom rules) | Limited to Stripe's model |
| Implementation | Complex | Simple |
| Maintenance | High (sync issues) | Low |

---

## File Structure: Mirrored Layout for Comparison

The codebase uses a **mirrored directory structure** so complexity differences are immediately visible. Each implementation has equivalent files that can be compared side-by-side.

```
subscription-prototype/
├── app/
│   ├── (credits)/                      # Route group: Custom credits implementation
│   │   ├── page.tsx                    # Dashboard
│   │   ├── subscription/page.tsx       # Subscription management
│   │   └── history/page.tsx            # Credit history
│   │
│   ├── (native)/                       # Route group: Stripe native implementation
│   │   └── native/
│   │       ├── page.tsx                # Dashboard (compare to credits)
│   │       ├── subscription/page.tsx   # Subscription management
│   │       └── history/page.tsx        # Usage history
│   │
│   ├── compare/                        # NEW: Side-by-side comparison page
│   │   └── page.tsx                    # Live complexity metrics
│   │
│   └── api/
│       ├── credits/                    # Custom credits API
│       │   ├── use/route.ts            # ~80 lines (complex)
│       │   ├── status/route.ts
│       │   ├── checkout/
│       │   │   ├── subscription/route.ts
│       │   │   └── addon/route.ts      # Add-on purchase
│       │   ├── portal/route.ts
│       │   └── history/route.ts
│       │
│       ├── native/                     # Stripe native API
│       │   ├── action/route.ts         # ~20 lines (simple - compare!)
│       │   ├── status/route.ts
│       │   ├── checkout/
│       │   │   └── subscription/route.ts
│       │   ├── portal/route.ts
│       │   ├── usage/route.ts          # Query Stripe meter
│       │   └── history/route.ts
│       │
│       └── webhooks/
│           ├── credits/route.ts        # Complex: credit allocation/sync
│           └── native/route.ts         # Simple: status updates only
│
├── lib/
│   ├── shared/                         # Shared utilities (both implementations)
│   │   ├── db.ts                       # Database connection
│   │   ├── stripe-client.ts            # Stripe initialization
│   │   └── types.ts                    # Common TypeScript types
│   │
│   ├── credits/                        # Custom credits logic (~500 lines total)
│   │   ├── allocate.ts                 # Credit allocation on events
│   │   ├── consume.ts                  # Credit consumption with locks
│   │   ├── expire.ts                   # Credit expiration logic
│   │   ├── sync.ts                     # Webhook sync logic
│   │   ├── schema.sql                  # 5 tables, ~50 lines
│   │   ├── constants.ts                # Tier configs
│   │   └── index.ts                    # Exports
│   │
│   └── native/                         # Stripe native logic (~100 lines total)
│       ├── meter.ts                    # Meter event helper (main file!)
│       ├── schema.sql                  # 3 tables, ~20 lines
│       ├── constants.ts                # Tier configs
│       └── index.ts                    # Exports
│
├── components/
│   ├── shared/                         # Shared UI components
│   │   ├── Toast.tsx
│   │   ├── Layout.tsx
│   │   └── SubscriptionBadge.tsx
│   │
│   ├── credits/                        # Credits-specific UI
│   │   ├── CreditDisplay.tsx           # Shows sub + addon credits
│   │   ├── ActionButton.tsx            # Disabled when credits=0
│   │   ├── AddonPurchase.tsx           # Upsell component
│   │   ├── LowCreditWarning.tsx        # Blocking warning
│   │   └── GracePeriodBanner.tsx
│   │
│   └── native/                         # Native-specific UI
│       ├── UsageDisplay.tsx            # Shows usage/included
│       ├── ActionButton.tsx            # Never disabled
│       ├── OverageWarning.tsx          # Informational (non-blocking)
│       └── UsageEstimate.tsx           # Estimated bill preview
│
├── cli/
│   ├── credits.ts                      # CLI for credits implementation
│   └── native.ts                       # CLI for native implementation
│
└── scripts/
    ├── init-credits-db.ts              # Initialize credits schema
    ├── init-native-db.ts               # Initialize native schema
    └── compare-complexity.ts           # Generate complexity report
```

---

## Making Complexity Evident

### Design Principle: Comparison at a Glance

The codebase structure makes complexity differences **immediately obvious** through:

1. **Mirrored directories** - Equivalent files in `/credits/` and `/native/`
2. **Line count comments** - Each file documents its complexity
3. **Side-by-side comparison page** - Live metrics at `/compare`
4. **Inline documentation** - Comments explain what Stripe handles

### File-by-File Comparison Table

| Function | Credits Implementation | Native Implementation | Difference |
|----------|------------------------|----------------------|------------|
| Perform action | `lib/credits/consume.ts` (~85 lines) | `lib/native/meter.ts` (~15 lines) | **-82%** |
| Webhook handler | `api/webhooks/credits/route.ts` (~200 lines) | `api/webhooks/native/route.ts` (~40 lines) | **-80%** |
| Database schema | 5 tables, 45 columns | 3 tables, 15 columns | **-67%** |
| Business logic files | 6 files | 1 file | **-83%** |
| Total custom code | ~500-800 lines | ~100-150 lines | **-75%** |

### Complexity Markers in Code

Each file includes header comments explaining its purpose and complexity:

**Credits implementation (`lib/credits/consume.ts`):**
```typescript
/**
 * COMPLEXITY: This entire file exists because we track credits locally.
 * In the Stripe Native version, this is replaced by a single API call:
 *   stripe.billing.meterEvents.create()
 *
 * This file handles:
 * - Acquiring user lock (race condition prevention)
 * - Checking subscription status
 * - Querying Stripe API near renewal boundaries (hybrid sync)
 * - Credit type priority (subscription credits before addon)
 * - Atomic balance updates
 * - Comprehensive audit logging
 * - Lock release
 *
 * Lines of code: ~85
 * Test cases needed: ~15
 * Edge cases handled: 8
 */
export async function consumeCredit(userId: number) {
  // ... complex logic
}
```

**Native implementation (`lib/native/meter.ts`):**
```typescript
/**
 * SIMPLICITY: This is the ENTIRE usage tracking implementation.
 * Stripe Meters handle:
 * - Usage aggregation
 * - Billing calculation
 * - Period resets
 * - Invoice line items
 *
 * Lines of code: ~15
 * Test cases needed: ~3
 * Edge cases handled: 0 (Stripe handles them)
 */
export async function recordAction(stripeCustomerId: string) {
  return stripe.billing.meterEvents.create({
    event_name: 'action_performed',
    payload: {
      stripe_customer_id: stripeCustomerId,
      value: '1'
    }
  });
}
```

### Schema Comparison

**Credits schema (`lib/credits/schema.sql`):**
```sql
-- 5 tables, ~50 lines
-- Required for local credit tracking

CREATE TABLE users (...);
CREATE TABLE subscriptions (
    -- 12 columns to track sync state with Stripe
    stripe_subscription_id TEXT,
    tier TEXT,
    status TEXT,
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end BOOLEAN,
    trial_end DATETIME,
    ...
);
CREATE TABLE credits (
    -- Separate tracking for two credit types
    subscription_credits INTEGER,
    addon_credits INTEGER,
    ...
);
CREATE TABLE credit_log (
    -- Full audit trail for all credit operations
    event_type TEXT,
    credits_change INTEGER,
    credit_type TEXT,
    balance_before INTEGER,
    balance_after INTEGER,
    stripe_event_id TEXT,  -- Idempotency
    ...
);
CREATE TABLE actions (...);
```

**Native schema (`lib/native/schema.sql`):**
```sql
-- 3 tables, ~20 lines
-- Minimal local state - Stripe is source of truth

CREATE TABLE users (...);
CREATE TABLE subscriptions (
    -- 6 columns - just status, Stripe handles the rest
    stripe_subscription_id TEXT,
    tier TEXT,
    status TEXT,
    current_period_start DATETIME,
    current_period_end DATETIME,
    ...
);
CREATE TABLE action_log (
    -- Optional - just for UI responsiveness
    stripe_meter_event_id TEXT,
    ...
);
-- NO credits table - Stripe tracks usage
-- NO credit_log - Stripe has usage records
```

### Comparison Dashboard (`/compare`)

A dedicated page shows live complexity metrics:

```typescript
// app/compare/page.tsx
export default async function ComparePage() {
  return (
    <div className="grid grid-cols-2 gap-8 p-8">
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Custom Credits (SPEC.md)</h2>
        <dl className="space-y-2">
          <div><dt>Database tables:</dt><dd>5</dd></div>
          <div><dt>Business logic files:</dt><dd>6</dd></div>
          <div><dt>Lines of custom code:</dt><dd>~600</dd></div>
          <div><dt>Webhook events handled:</dt><dd>7 (complex)</dd></div>
          <div><dt>Race condition handling:</dt><dd>Required</dd></div>
          <div><dt>Credit expiration logic:</dt><dd>Custom</dd></div>
        </dl>
        <h3 className="mt-4 font-semibold">Trade-offs:</h3>
        <ul className="list-disc ml-4 text-sm">
          <li>Pre-pay model (user controls spend)</li>
          <li>Add-on upsell opportunity</li>
          <li>Complex but flexible</li>
        </ul>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Stripe Native (This Spec)</h2>
        <dl className="space-y-2">
          <div><dt>Database tables:</dt><dd>3</dd></div>
          <div><dt>Business logic files:</dt><dd>1</dd></div>
          <div><dt>Lines of custom code:</dt><dd>~120</dd></div>
          <div><dt>Webhook events handled:</dt><dd>4 (simple)</dd></div>
          <div><dt>Race condition handling:</dt><dd>Not needed</dd></div>
          <div><dt>Credit expiration logic:</dt><dd>None (Stripe)</dd></div>
        </dl>
        <h3 className="mt-4 font-semibold">Trade-offs:</h3>
        <ul className="list-disc ml-4 text-sm">
          <li>Post-pay model (surprise bills possible)</li>
          <li>No add-on concept</li>
          <li>Simple but less flexible</li>
        </ul>
      </div>
    </div>
  );
}
```

### What Makes Complexity Evident

| Signal | How It's Surfaced |
|--------|-------------------|
| **Line count** | Header comments in every file |
| **File count** | Mirrored directories make this visual |
| **Cognitive load** | Inline comments explain "why this exists" |
| **Failure modes** | Edge cases documented (credits has more) |
| **Test surface** | Credits needs more tests (more code paths) |
| **Maintenance burden** | README comparison table |

### Landing Page Navigation

The root page (`/`) provides clear navigation to both implementations:

```
┌─────────────────────────────────────────────────────────────┐
│                  Subscription Prototype                      │
│                                                              │
│  Compare two approaches to credit-based billing:            │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │   Custom Credits    │    │   Stripe Native     │        │
│  │                     │    │                     │        │
│  │   Pre-pay model     │    │   Post-pay model    │        │
│  │   Local tracking    │    │   Stripe Meters     │        │
│  │   ~600 lines code   │    │   ~120 lines code   │        │
│  │                     │    │                     │        │
│  │   [Open Dashboard]  │    │   [Open Dashboard]  │        │
│  └─────────────────────┘    └─────────────────────┘        │
│                                                              │
│              [View Side-by-Side Comparison]                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variables (Additional)

```env
# Existing variables...

# Stripe Native (Meters) - Additional
STRIPE_METER_ID=mtr_...
STRIPE_NATIVE_WEBHOOK_SECRET=whsec_...

# Subscription Prices (with metered component)
STRIPE_NATIVE_STARTER_LICENSE_PRICE_ID=price_...
STRIPE_NATIVE_STARTER_USAGE_PRICE_ID=price_...
STRIPE_NATIVE_EXPERT_LICENSE_PRICE_ID=price_...
STRIPE_NATIVE_EXPERT_USAGE_PRICE_ID=price_...
STRIPE_NATIVE_PRO_LICENSE_PRICE_ID=price_...
STRIPE_NATIVE_PRO_USAGE_PRICE_ID=price_...
```

---

## Stripe Products to Create

### 1. Meter

```javascript
// Create once
stripe.billing.meters.create({
    display_name: 'Actions',
    event_name: 'action_performed',
    default_aggregation: { formula: 'sum' },
    customer_mapping: {
        type: 'by_id',
        event_payload_key: 'stripe_customer_id'
    },
    value_settings: {
        event_payload_key: 'value'
    }
});
```

### 2. Products with Two-Part Pricing

For each tier, create:

**Starter Product:**
- License Price: $10/month recurring
- Usage Price: Tiered metered, linked to meter
  - Tier 1: 0-1 @ $0
  - Tier 2: 2+ @ $8

**Expert Product:**
- License Price: $15/month recurring
- Usage Price: Tiered metered, linked to meter
  - Tier 1: 0-5 @ $0
  - Tier 2: 6+ @ $6

**Pro Product:**
- License Price: $20/month recurring
- Usage Price: Tiered metered, linked to meter
  - Tier 1: 0-10 @ $0
  - Tier 2: 11+ @ $4

---

## CLI Testing Tools (Extended)

Additional commands for native implementation:

| Command | Description |
|---------|-------------|
| `native:status` | Show user state and Stripe meter usage |
| `native:reset` | Wipe native tables, reinitialize |
| `native:action` | Perform action (send meter event) |
| `native:usage` | Query current meter usage from Stripe |
| `native:simulate-billing` | Advance test clock to trigger billing |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Meter event fails | Retry with idempotency key, show error to user |
| User performs many actions quickly | Each sends meter event (Stripe handles 1000/sec) |
| Billing cycle ends mid-action | Action still recorded, appears on next invoice |
| User disputes overage charges | Business/support issue, not technical |
| Meter event delayed | Stripe aggregates asynchronously, invoice reflects all usage |
| High usage during trial | Overages charged at conversion |
| Subscription canceled mid-cycle | Usage up to cancellation billed normally |

---

## Success Criteria

The Stripe Native prototype is successful if it demonstrates:

1. [ ] User can subscribe via Stripe Checkout (two-part pricing)
2. [ ] Meter is created and linked to usage price
3. [ ] Action button sends meter events to Stripe
4. [ ] Current usage displays correctly from Stripe API
5. [ ] Overage estimate calculates correctly
6. [ ] User is never blocked (post-pay model)
7. [ ] Invoice shows flat fee + usage breakdown
8. [ ] Upgrade/downgrade works via Customer Portal
9. [ ] Webhook events update local subscription status
10. [ ] Implementation is significantly simpler than SPEC.md

---

## Implementation Complexity Summary

### SPEC.md: ~500-800 lines of credit logic
- Credit allocation on subscription events
- Credit expiration on renewals/cancellation
- Credit consumption with type priority
- Credit balance synchronization
- Race condition prevention
- Webhook idempotency for credits

### This Spec: ~100-150 lines of usage logic
- Send meter event on action
- Query Stripe for current usage
- Display usage vs included
- Update subscription status on webhooks

**Estimated Reduction**: 70-80% less custom code

---

## References

- [Stripe Flat Fee + Overages Model](https://docs.stripe.com/billing/subscriptions/usage-based-v1/use-cases/flat-fee-and-overages)
- [Stripe Meters API](https://docs.stripe.com/api/billing/meter)
- [Create Meter Events](https://docs.stripe.com/api/billing/meter-event/create)
- [Recording Usage API](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api)
