# The Corner Cases That Will Break Your Subscription System

Building a subscription system seems straightforward until you encounter your first edge case. Then you encounter ten more. This document catalogs the scenarios that trip up most implementations, with concrete examples of what happens and how to handle each one.

---

## The Cancellation Trap

**Scenario:** Sarah subscribes to Expert ($15/month, 5 credits) on January 15th. She uses 3 credits by January 25th, then decides to cancel. What happens to her remaining 2 credits?

**The trap:** Many systems immediately revoke access on cancellation. This frustrates users who feel they paid for something they didn't receive.

**The right approach:** Cancellation schedules the end, it doesn't trigger it. Sarah keeps her 2 credits until February 15th. Stripe calls this `cancel_at_period_end`. On February 15th, Stripe sends `customer.subscription.deleted`, and only then do you expire her remaining credits.

**Timeline:**
```
Jan 15: Subscribe → 5 credits
Jan 25: Used 3 → 2 credits remain
Jan 25: Cancel clicked → cancel_at_period_end = true, still 2 credits
Feb 10: Uses 1 more → 1 credit remains (still works!)
Feb 15: Period ends → 1 credit expires, subscription terminated
```

---

## The Upgrade Puzzle

**Scenario:** Mike is on Starter (1 credit/month) and has used his credit. Mid-cycle, he upgrades to Pro (10 credits/month). How many credits does he get?

**The trap:** Giving him the full 10 credits means he essentially got Starter for free this month. Giving him nothing until next cycle punishes him for upgrading.

**The right approach:** Prorated difference. Pro gives 10, Starter gives 1, so Mike gets 9 additional credits immediately. He's paying the prorated price difference anyway (Stripe handles this), so the credits should match.

**But what if he had credits left?** Say Mike had his 1 Starter credit unused. After upgrade, he has 1 + 9 = 10 credits. The original credit is still subscription credit, so it'll expire at cycle end along with the 9 new ones.

---

## The Downgrade Dilemma

**Scenario:** Lisa is on Pro (10 credits) and has 7 remaining. She downgrades to Starter (1 credit). What happens to her 7 credits?

**The trap:** Immediately reducing her to 1 credit feels like theft. She paid for Pro this month.

**The right approach:** She keeps all 7 credits until she uses them or the cycle ends. The downgrade takes effect at the next billing cycle. On renewal, she gets 1 credit (Starter allocation), not 10.

**Why this works:** She paid Pro prices for this cycle, so she gets Pro value. Next cycle, she pays Starter prices, she gets Starter value. No one feels cheated.

---

## The Failed Payment Limbo

**Scenario:** Tom's card gets declined on his renewal date. He has 0 subscription credits (used them all) but 5 addon credits. What can he do?

**The trap:** Immediately locking him out creates a terrible experience for what might be a temporary card issue (new card number, bank flagged it, insufficient funds for a day).

**The right approach:** Grace period. For 7 days, Stripe retries the payment with intelligent timing. During this window:
- Tom sees a warning banner: "Payment failed. Please update your card."
- He can use his 5 addon credits (he paid for those separately)
- He cannot buy more addons (that would be weird—he can't pay for his subscription but can buy extras?)
- If payment succeeds within 7 days, life continues normally
- If payment fails after 7 days, subscription suspends

**The nuance:** The `past_due` status is your signal. It means "we're trying, but it's not looking good."

---

## The Renewal Race

**Scenario:** It's 12:01 AM on Alex's renewal date. She has 0 credits and tries to perform an action. The renewal happened in Stripe, but your webhook hasn't arrived yet. Should she be blocked?

**The trap:** Blocking her when she's technically paid is frustrating. But letting her through when maybe payment actually failed is risky.

**The right approach:** Check Stripe directly. When credits are 0 and you're within a few hours of the renewal timestamp, make an API call to verify subscription status. If the latest invoice is paid, allocate credits immediately and let her proceed. Log that you did this so you don't double-allocate when the webhook arrives (idempotency).

**Why webhooks aren't instant:** Stripe batches events, network latency exists, your server might have been briefly unavailable. A few seconds to a few minutes delay is normal. Hours of delay is rare but possible.

---

## The Double-Click Disaster

**Scenario:** Dave has 1 credit left. He clicks the action button, but his connection is slow. Frustrated, he clicks again. And again.

**The trap:** Without protection, three requests race to your server. All three read "1 credit available." All three decrement. Dave ends up with -2 credits and performed 3 actions he only paid for once.

**The right approach:** Defense in depth.

*Client-side:* Disable the button immediately on click. Re-enable only after response.

*Server-side:* Atomic database operations with row-level locking. Check-then-decrement must be a single transaction.

```sql
UPDATE credits
SET subscription_credits = subscription_credits - 1
WHERE user_id = ? AND subscription_credits > 0
```

If this updates 0 rows, the credit wasn't available. No race condition possible.

---

## The Addon Orphan

**Scenario:** Emma buys addon credits while subscribed. Then she cancels. Her subscription ends, but she has 10 addon credits remaining. Can she use them?

**The trap:** She paid real money for those credits. Completely blocking them feels unfair.

**The counterpoint:** Your system requires a subscription to function. Addon credits are extras, not standalone products.

**The decision we made:** Subscription required. Her addon credits persist indefinitely (they never expire), but she must resubscribe to use them. When she does resubscribe, they're waiting for her.

**Why this makes sense:** Addons are priced assuming subscription context. They're cheaper per-credit than if she just bought credits à la carte. The subscription is the baseline relationship; addons extend it.

---

## The Trial Timeout

**Scenario:** New user Jamie starts a 14-day trial with 1 credit (Starter level). She uses it on day 3. On day 14, she hasn't subscribed. What happens?

**The trap:** Auto-converting to paid without explicit consent (and without payment method) is impossible. But just killing access feels abrupt.

**The right approach:** Trial ends, subscription becomes inactive. Her 0 remaining credits become 0 expired credits (not much changes numerically, but status changes). She cannot perform actions. She sees: "Your trial has ended. Subscribe to continue."

**Key detail:** She cannot start another trial. Ever. Trial is a one-time gift for new users, not an exploit for perpetual free service.

---

## The Webhook That Never Came

**Scenario:** Payment succeeded in Stripe. Credits should be allocated. But your server was down for 5 minutes and the webhook was never received.

**The trap:** User paid but has no credits. They're angry. You have no idea anything is wrong.

**The right approach:** Hybrid verification. On critical actions (using credits, viewing dashboard), check Stripe if things look stale:
- Current period ended but credits are 0?
- Check Stripe for latest invoice status
- Allocate if paid, update local state

**Also:** Stripe retries webhooks for up to 3 days. Usually the event arrives eventually. Your hybrid check is a safety net, not the primary mechanism.

**Monitoring:** Log every webhook received. Alert if you go unusually long without seeing expected events (like `invoice.paid` around renewal dates).

---

## The Mid-Cycle Meter

**Scenario:** A user upgrades on day 15 of a 30-day cycle. When does their next renewal happen?

**The trap:** Assuming it resets to day 15 as the new anchor.

**Reality:** Stripe keeps the original anchor by default. If they subscribed on the 1st, they renew on the 1st. The upgrade is prorated for the remaining 15 days.

**What this means for credits:** On day 15, they get the prorated credit difference. On day 1 (renewal), they get full new-tier allocation and any remaining credits expire.

---

## The Refund Request

**Scenario:** User demands a refund because they "didn't use all their credits."

**The position:** No refunds for unused credits within a billing cycle. This was decided in the spec.

**The rationale:** Credits are access tokens, not stored value. The user paid for the ability to use up to N actions this month. Whether they used that ability is up to them. Gyms don't refund you for days you didn't work out.

**The escape hatch:** For genuinely wronged users (system outage prevented usage, etc.), you can manually add addon credits as goodwill. These don't expire, so they're not losing anything even if they leave.

---

## Summary Table

| Scenario | What Happens | Key Webhook |
|----------|--------------|-------------|
| Cancel mid-cycle | Keep credits until period end | `subscription.updated` then `subscription.deleted` |
| Upgrade mid-cycle | Get prorated credit difference immediately | `subscription.updated` |
| Downgrade mid-cycle | Keep current credits, lower allocation next cycle | `subscription.updated` |
| Payment fails | 7-day grace, limited functionality | `invoice.payment_failed` |
| Renewal with unused credits | Old credits expire, fresh allocation | `invoice.paid` |
| Trial ends | Credits expire, subscription inactive | `subscription.deleted` |
| Double-click | Server-side atomic check prevents overdraw | N/A (app logic) |
| Webhook delayed | Hybrid Stripe API check on critical actions | N/A (fallback) |
| Cancelled user with addons | Credits preserved but unusable | `subscription.deleted` |

---

## The Meta-Lesson

Every corner case shares a common theme: **state transitions are rarely instant, and timing matters**.

A subscription isn't binary (active/inactive). It flows through states: trialing → active → past_due → canceled. Credits aren't just a number; they're a number with context (subscription vs addon, cycle boundaries, expiration rules).

The systems that handle these gracefully are the ones that model state explicitly and handle transitions deliberately. The ones that break are the ones that treat subscriptions as if they were light switches.
