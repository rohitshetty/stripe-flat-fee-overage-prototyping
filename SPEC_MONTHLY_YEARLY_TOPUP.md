# Subscription System Specification
## Monthly/Yearly Plans with Top-ups

---

## 1. Overview

A subscription-based system for organizations to access a click-based feature. One subscription per organization with a shared click pool across all members.

---

## 2. Plans & Pricing

### 2.1 Monthly Plan
- **Price:** $250/month
- **Allocation:** 100 clicks per month
- **Carryover:** Up to 50 unused clicks roll over to next month
- **Carryover Cap:** Maximum 50 clicks can carry over, regardless of source or accumulated balance

### 2.2 Yearly Plan
- **Price:** $5,000/year
- **Allocation:** 2,500 clicks per year
- **Carryover:** None. Unused clicks do not roll over at year end
- **Display:** Show full yearly pool ("2,500 clicks remaining this year")

### 2.3 Top-up Credits
- **Price:** $150 per 50 clicks
- **Expiration:** Never expire (while subscription is active)
- **Purchase Limit:** No limit on number of top-up purchases
- **Purchase Method:** One-time Stripe Checkout session
- **Availability:** Only available to active (non-paused, non-trial) subscribers

### 2.4 Pricing Display
- Show "Save X%" comparison for yearly plan vs. monthly equivalent
- All prices in USD only

---

## 3. Click Mechanics

### 3.1 Consumption Order
1. **Subscription clicks consumed first**
2. **Top-up clicks consumed second**

This maximizes the value of non-expiring top-ups.

### 3.2 Carryover Calculation (Monthly Plans)

**At month end:**
- Calculate unused subscription clicks
- Carry over minimum of (unused clicks, 50)
- Add fresh 100 clicks
- **Cap always applies:** Maximum carryover is always 50, regardless of balance source

**Example:**
- User has 150 clicks (50 carried + 100 fresh)
- Uses 20 clicks during month
- Balance: 130 clicks
- At month end: 50 carried + 100 fresh = 150 clicks

### 3.3 Zero Balance Behavior
- **Hard block** on click-based feature
- Display prominent prompt to purchase top-up credits
- No overage billing or soft limits

---

## 4. Account Model

### 4.1 Organization Structure
- Subscription is tied to an **organization**, not individual users
- All org members share the same click pool
- No per-user click tracking or allocation

### 4.2 Organization Creation Requirements
- Company/Organization name
- Business address
- Tax ID
- Billing email
- Creating user becomes the owner automatically

### 4.3 Billing Administration
- **Single billing admin per organization** (to avoid concurrent modification conflicts)
- Only the billing admin can:
  - Purchase/change subscription
  - Purchase top-ups
  - Pause/unpause subscription
  - Cancel subscription
  - Update payment methods
- Organization owner can assign the billing admin role

---

## 5. Trial Period

### 5.1 Trial Terms
- **Duration:** 14 days
- **Click Allocation:** 10 clicks
- **Early Termination:** Trial ends early if all 10 clicks are exhausted
- **Top-ups:** Not available during trial period

### 5.2 Trial End Behavior
- **Grace period:** 3 days after trial ends
- **During grace:** Persistent prompts/nudges to subscribe
- **After grace:** Click-based feature blocked until subscription purchase

### 5.3 Trial to Subscription
- User must explicitly choose monthly or yearly plan
- Trial clicks do not carry over to subscription

---

## 6. Subscription Management

### 6.1 Plan Switching

**Monthly → Yearly:**
- Can switch anytime
- Pay full yearly price ($5,000)
- Remaining monthly clicks carry over and are added to yearly allocation
- No pro-rata credit for unused monthly time

**Yearly → Monthly:**
- Can schedule downgrade for next billing cycle
- Cannot downgrade mid-year with immediate effect
- At yearly renewal (with 30-day notice), easy option to switch to monthly

**Monthly ↔ Monthly / Yearly ↔ Yearly:**
- N/A (same plan)

### 6.2 Subscription Pause

**Pause Initiation:**
- Takes effect **immediately**
- All clicks (subscription + top-up) are frozen
- No expiration or carryover processing while paused

**Pause Duration:**
- **No limit** on pause duration
- Subscription remains in paused state indefinitely until user action

**While Paused:**
- Cannot use any clicks
- Cannot purchase top-ups
- Cannot cancel subscription (must unpause first)
- Can access account to unpause

**Resume:**
- Clicks restored to pre-pause balance
- Billing cycle resumes from where it left off

### 6.3 Cancellation

**Cancellation Process:**
- Must unpause first if paused
- Takes effect at end of current billing cycle

**Post-Cancellation:**
- Can use remaining clicks until billing cycle ends
- At cycle end: **all clicks forfeited** (subscription AND top-ups)
- No access to click-based feature after cycle ends
- Top-ups are not preserved or refundable

**Reactivation:**
- Completely fresh start
- No restoration of previous clicks or top-ups
- No loyalty pricing or win-back offers

### 6.4 Refunds
- **Case-by-case basis** via customer support
- No automatic refund mechanism
- Support has discretion to issue refunds based on circumstances

---

## 7. Billing & Payments

### 7.1 Renewal

**Monthly:**
- Auto-renews at start of each month
- Standard Stripe subscription behavior

**Yearly:**
- Auto-renews with **30-day advance notice** via email
- Notice includes easy option to:
  - Continue with yearly
  - Switch to monthly
  - Cancel

### 7.2 Failed Payments

**Grace Period:** 7 days

**During Grace:**
- **Read-only access** to product
- Cannot use clicks
- Email notifications to update payment method
- Stripe automatic retry mechanism active

**After Grace:**
- Subscription suspended
- Full block on access

### 7.3 Timezone Handling
- Stripe default behavior based on payment method/location
- No custom timezone configuration

---

## 8. Notifications

### 8.1 Carryover Warnings (Monthly Plans)
- **Email:** 3-5 days before cycle end if user will lose clicks due to cap
- **In-app banner:** Warning displayed when approaching cycle end with excess balance

### 8.2 Usage Threshold Alerts
Email notifications at:
- 50% of clicks used
- 25% remaining
- 10% remaining

### 8.3 Billing Notifications
- Successful payment receipt
- Failed payment alert
- Yearly renewal 30-day notice
- Subscription cancelled confirmation
- Pause/unpause confirmation

---

## 9. Stripe Integration

### 9.1 Checkout Flow
- **Stripe Checkout (redirect)** for all purchases
- No embedded checkout or custom Stripe Elements UI
- Separate checkout sessions for:
  - Initial subscription purchase
  - Top-up purchases (one-time payments)

### 9.2 Customer Portal
- **Stripe Customer Portal** for all subscription management
- Link/redirect from app settings
- Used for:
  - Updating payment method
  - Viewing invoices
  - Managing subscription (via Stripe's UI)

### 9.3 Webhook Handling
- Trust Stripe's automatic retry mechanism
- **Daily reconciliation job** as safety net
- Sync subscription status, payment status, and click allocations

### 9.4 Data Model Considerations
```
Organization
├── stripe_customer_id
├── subscription_status (trial | active | paused | cancelled | past_due)
├── current_plan (monthly | yearly | null)
├── billing_cycle_anchor
├── subscription_clicks (current allocation from subscription)
├── topup_clicks (purchased top-up balance)
├── carryover_clicks (from previous cycle, max 50)
└── trial_ends_at

Subscription Events (for reconciliation)
├── event_id
├── event_type
├── stripe_event_id
├── processed_at
└── payload
```

---

## 10. Edge Cases & Business Rules

### 10.1 Carryover Edge Cases

| Scenario | End Balance | Carries Over | Next Month Start |
|----------|-------------|--------------|------------------|
| Used all 100 clicks | 0 | 0 | 100 |
| Used 60 of 100 | 40 | 40 | 140 |
| Used 20 of 100 | 80 | 50 (capped) | 150 |
| Had 150, used 20 | 130 | 50 (capped) | 150 |
| Had 150, used 140 | 10 | 10 | 110 |

### 10.2 Click Source Tracking
Track clicks by source for proper consumption order:
1. Subscription clicks (expire/cap applies)
2. Top-up clicks (no expiry while subscribed)

### 10.3 Concurrency
- Single billing admin per org eliminates concurrent modification conflicts
- No need for optimistic locking on billing operations

### 10.4 Disputes
- System database is **source of truth**
- No automatic adjustments based on user claims
- Users must accept system-recorded click counts

---

## 11. User Flows

### 11.1 New Organization Flow
1. User signs up / creates account
2. Create organization (business details required)
3. 14-day trial starts automatically with 10 clicks
4. Use click-based feature
5. Trial ends (time or clicks exhausted)
6. 3-day grace period with prompts
7. Subscribe to monthly or yearly

### 11.2 Subscription Flow
1. Click "Subscribe" → Stripe Checkout redirect
2. Select monthly ($250) or yearly ($5,000)
3. Complete payment
4. Redirect back to app
5. Subscription active, clicks allocated

### 11.3 Top-up Flow
1. Click "Buy More Clicks"
2. Stripe Checkout redirect (one-time payment)
3. Complete $150 payment
4. Redirect back to app
5. 50 clicks added to top-up balance

### 11.4 Pause Flow
1. Billing admin clicks "Pause Subscription"
2. Confirmation dialog (immediate effect warning)
3. Subscription paused immediately
4. All clicks frozen
5. User sees "Paused" status
6. To resume: Click "Resume Subscription"
7. Clicks restored, billing resumes

### 11.5 Cancel Flow
1. If paused, must unpause first
2. Billing admin clicks "Cancel Subscription"
3. Confirmation dialog (clicks forfeit at cycle end)
4. Subscription marked for cancellation
5. Access continues until cycle end
6. At cycle end: all clicks forfeited, access blocked

---

## 12. Out of Scope (for MVP)

- Multiple currencies
- Per-user click tracking/allocation
- Enterprise/custom pricing tiers
- Volume discounts
- Loyalty pricing for returning customers
- Custom billing UI (using Stripe Portal)
- Multiple subscriptions per organization

---

## 13. Open Questions / Future Considerations

1. **Click definition:** What specific action constitutes a "click"? (Placeholder for actual feature)
2. **Analytics:** Should we track click usage patterns for business intelligence?
3. **API access:** Will there be programmatic access that also consumes clicks?
4. **Multi-org users:** Can one user belong to multiple organizations?

---

## 14. Summary Table

| Feature | Monthly | Yearly | Top-up |
|---------|---------|--------|--------|
| Price | $250/mo | $5,000/yr | $150 |
| Clicks | 100 | 2,500 | 50 |
| Carryover | 50 max | None | N/A (no expiry) |
| Renewal | Auto | Auto + 30-day notice | One-time |
| Pause | Yes | Yes | Frozen with subscription |

---

*Document generated based on product requirements interview.*
*Last updated: January 2026*
