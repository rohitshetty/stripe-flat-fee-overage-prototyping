import {
  getSubscription,
  upsertSubscription,
  logCreditEvent,
  Subscription,
} from './db'
import { TierName, GRACE_PERIOD_DAYS } from './constants'
import { expireSubscriptionCredits, allocateSubscriptionCredits } from './credits'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'none'

export interface SubscriptionInfo {
  tier: TierName
  status: SubscriptionStatus
  stripeSubscriptionId: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEnd: Date | null
  daysUntilRenewal: number | null
  isInGracePeriod: boolean
  gracePeriodEndsAt: Date | null
}

// Get subscription info for display
export function getSubscriptionInfo(userId: number = 1): SubscriptionInfo {
  const sub = getSubscription(userId)

  if (!sub) {
    return {
      tier: 'starter',
      status: 'none',
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
      daysUntilRenewal: null,
      isInGracePeriod: false,
      gracePeriodEndsAt: null,
    }
  }

  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null
  const now = new Date()

  // Calculate days until renewal
  let daysUntilRenewal: number | null = null
  if (periodEnd && !sub.cancel_at_period_end) {
    daysUntilRenewal = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntilRenewal < 0) daysUntilRenewal = 0
  }

  // Check if in grace period
  const isInGracePeriod = sub.status === 'past_due'
  let gracePeriodEndsAt: Date | null = null

  if (isInGracePeriod && periodEnd) {
    gracePeriodEndsAt = new Date(periodEnd.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  }

  return {
    tier: sub.tier as TierName,
    status: sub.status as SubscriptionStatus,
    stripeSubscriptionId: sub.stripe_subscription_id,
    currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start) : null,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    trialEnd: sub.trial_end ? new Date(sub.trial_end) : null,
    daysUntilRenewal,
    isInGracePeriod,
    gracePeriodEndsAt,
  }
}

// Update subscription from Stripe data
export function updateSubscriptionFromStripe(
  userId: number,
  data: {
    stripeSubscriptionId: string
    tier: TierName
    status: SubscriptionStatus
    currentPeriodStart: Date
    currentPeriodEnd: Date
    cancelAtPeriodEnd: boolean
    trialEnd?: Date | null
  },
  stripeEventId?: string
): void {
  const existing = getSubscription(userId)
  const oldTier = existing?.tier as TierName | undefined
  const oldStatus = existing?.status

  upsertSubscription(userId, {
    stripe_subscription_id: data.stripeSubscriptionId,
    tier: data.tier,
    status: data.status,
    current_period_start: data.currentPeriodStart.toISOString(),
    current_period_end: data.currentPeriodEnd.toISOString(),
    cancel_at_period_end: data.cancelAtPeriodEnd,
    trial_end: data.trialEnd?.toISOString() ?? null,
  })

  // Log status changes
  if (oldStatus !== data.status) {
    logCreditEvent(userId, 'subscription_status_change', {
      description: `Status changed: ${oldStatus ?? 'none'} → ${data.status}`,
      stripeEventId,
    })
  }

  // Log tier changes
  if (oldTier && oldTier !== data.tier) {
    logCreditEvent(userId, 'subscription_tier_change', {
      description: `Tier changed: ${oldTier} → ${data.tier}`,
      stripeEventId,
    })
  }
}

// Handle subscription created
export function handleSubscriptionCreated(
  userId: number,
  data: {
    stripeSubscriptionId: string
    tier: TierName
    status: SubscriptionStatus
    currentPeriodStart: Date
    currentPeriodEnd: Date
    trialEnd?: Date | null
  },
  stripeEventId?: string
): void {
  updateSubscriptionFromStripe(userId, {
    ...data,
    cancelAtPeriodEnd: false,
  }, stripeEventId)

  // Allocate initial credits if not trialing
  if (data.status === 'active') {
    allocateSubscriptionCredits(userId, data.tier, stripeEventId)
  } else if (data.status === 'trialing') {
    // For trials, still allocate credits
    allocateSubscriptionCredits(userId, data.tier, stripeEventId)
  }

  logCreditEvent(userId, 'subscription_created', {
    description: `Subscription created: ${data.tier} (${data.status})`,
    stripeEventId,
  })
}

// Handle subscription updated (including upgrades/downgrades)
export function handleSubscriptionUpdated(
  userId: number,
  data: {
    stripeSubscriptionId: string
    tier: TierName
    status: SubscriptionStatus
    currentPeriodStart: Date
    currentPeriodEnd: Date
    cancelAtPeriodEnd: boolean
    trialEnd?: Date | null
  },
  stripeEventId?: string
): void {
  const existing = getSubscription(userId)
  const oldTier = existing?.tier as TierName | undefined

  updateSubscriptionFromStripe(userId, data, stripeEventId)

  // Handle cancel_at_period_end change
  if (data.cancelAtPeriodEnd && !existing?.cancel_at_period_end) {
    logCreditEvent(userId, 'subscription_cancel_scheduled', {
      description: `Cancellation scheduled for ${data.currentPeriodEnd.toLocaleDateString()}`,
      stripeEventId,
    })
  }
}

// Handle subscription deleted (actually canceled)
export function handleSubscriptionDeleted(
  userId: number,
  stripeSubscriptionId: string,
  stripeEventId?: string
): void {
  // Expire remaining subscription credits
  expireSubscriptionCredits(userId, stripeEventId, 'Subscription canceled')

  // Update status
  upsertSubscription(userId, {
    status: 'canceled',
    cancel_at_period_end: false,
  })

  logCreditEvent(userId, 'subscription_deleted', {
    description: 'Subscription ended',
    stripeEventId,
  })
}

// Handle invoice paid (renewal)
export function handleInvoicePaid(
  userId: number,
  tier: TierName,
  stripeEventId?: string
): void {
  // Allocate new credits (this expires old ones first)
  allocateSubscriptionCredits(userId, tier, stripeEventId)
}

// Handle payment failed
export function handlePaymentFailed(
  userId: number,
  stripeEventId?: string
): void {
  upsertSubscription(userId, {
    status: 'past_due',
  })

  logCreditEvent(userId, 'payment_failed', {
    description: 'Payment failed, entering grace period',
    stripeEventId,
  })
}

// Check if user can purchase addons
export function canPurchaseAddons(userId: number = 1): boolean {
  const sub = getSubscription(userId)
  if (!sub) return false

  // Can't purchase during grace period or after cancellation
  const allowedStatuses = ['active', 'trialing']
  return allowedStatuses.includes(sub.status)
}

// Set subscription directly (for testing/CLI)
export function setSubscription(
  userId: number,
  tier: TierName,
  status: SubscriptionStatus
): void {
  upsertSubscription(userId, {
    tier,
    status,
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })

  logCreditEvent(userId, 'manual_adjustment', {
    description: `Manual: set subscription to ${tier} (${status})`,
  })
}
