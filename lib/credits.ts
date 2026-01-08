import {
  getCredits,
  updateCredits,
  logCreditEvent,
  getSubscription,
  incrementActionCount,
  getActions,
  transaction,
} from './db'
import { canUseCredits, getTierCredits, TierName } from './constants'

export interface CreditBalance {
  subscriptionCredits: number
  addonCredits: number
  totalCredits: number
}

export interface UseCreditsResult {
  success: boolean
  error?: string
  balance?: CreditBalance
  actionCount?: number
}

// Get current credit balance
export function getCreditBalance(userId: number = 1): CreditBalance {
  const credits = getCredits(userId)
  const subscriptionCredits = credits?.subscription_credits ?? 0
  const addonCredits = credits?.addon_credits ?? 0

  return {
    subscriptionCredits,
    addonCredits,
    totalCredits: subscriptionCredits + addonCredits,
  }
}

// Use one credit (subscription first, then addon)
export function useCredit(userId: number = 1): UseCreditsResult {
  return transaction(() => {
    // Check subscription status
    const subscription = getSubscription(userId)
    if (!subscription || !canUseCredits(subscription.status)) {
      return {
        success: false,
        error: 'No active subscription',
      }
    }

    // Get current credits
    const credits = getCredits(userId)
    if (!credits) {
      return {
        success: false,
        error: 'Credit record not found',
      }
    }

    const { subscription_credits, addon_credits } = credits

    // Determine which credit type to use
    let newSubscriptionCredits = subscription_credits
    let newAddonCredits = addon_credits
    let creditType: 'subscription' | 'addon'

    if (subscription_credits > 0) {
      newSubscriptionCredits -= 1
      creditType = 'subscription'
    } else if (addon_credits > 0) {
      newAddonCredits -= 1
      creditType = 'addon'
    } else {
      return {
        success: false,
        error: 'No credits available',
      }
    }

    // Update credits
    updateCredits(userId, newSubscriptionCredits, newAddonCredits)

    // Increment action counter
    incrementActionCount(userId)

    // Log the event
    const totalBefore = subscription_credits + addon_credits
    const totalAfter = newSubscriptionCredits + newAddonCredits

    logCreditEvent(userId, 'usage', {
      creditsChange: -1,
      creditType,
      balanceBefore: totalBefore,
      balanceAfter: totalAfter,
      description: `Used 1 ${creditType} credit`,
    })

    const actions = getActions(userId)

    return {
      success: true,
      balance: {
        subscriptionCredits: newSubscriptionCredits,
        addonCredits: newAddonCredits,
        totalCredits: totalAfter,
      },
      actionCount: actions?.total_count ?? 0,
    }
  })
}

// Allocate subscription credits (used on renewal)
export function allocateSubscriptionCredits(
  userId: number,
  tier: TierName,
  stripeEventId?: string
): void {
  transaction(() => {
    const credits = getCredits(userId)
    if (!credits) return

    const currentSubCredits = credits.subscription_credits
    const currentAddonCredits = credits.addon_credits

    // Expire any remaining subscription credits first
    if (currentSubCredits > 0) {
      logCreditEvent(userId, 'credits_expired', {
        creditsChange: -currentSubCredits,
        creditType: 'subscription',
        balanceBefore: currentSubCredits + currentAddonCredits,
        balanceAfter: currentAddonCredits,
        description: 'Subscription credits expired at cycle end',
        stripeEventId,
      })
    }

    // Allocate new credits based on tier
    const newCredits = getTierCredits(tier)

    updateCredits(userId, newCredits, currentAddonCredits)

    logCreditEvent(userId, 'subscription_renewal', {
      creditsChange: newCredits,
      creditType: 'subscription',
      balanceBefore: currentAddonCredits, // After expiring old credits
      balanceAfter: newCredits + currentAddonCredits,
      description: `Allocated ${newCredits} credits for ${tier} tier`,
      stripeEventId,
    })
  })
}

// Add credits on upgrade (prorated difference)
export function addUpgradeCredits(
  userId: number,
  oldTier: TierName,
  newTier: TierName,
  stripeEventId?: string
): void {
  const oldCredits = getTierCredits(oldTier)
  const newCredits = getTierCredits(newTier)
  const difference = newCredits - oldCredits

  if (difference <= 0) return

  transaction(() => {
    const credits = getCredits(userId)
    if (!credits) return

    const totalBefore = credits.subscription_credits + credits.addon_credits
    const newSubCredits = credits.subscription_credits + difference

    updateCredits(userId, newSubCredits, credits.addon_credits)

    logCreditEvent(userId, 'subscription_change', {
      creditsChange: difference,
      creditType: 'subscription',
      balanceBefore: totalBefore,
      balanceAfter: newSubCredits + credits.addon_credits,
      description: `Upgrade from ${oldTier} to ${newTier}: +${difference} credits`,
      stripeEventId,
    })
  })
}

// Add addon credits
export function addAddonCredits(
  userId: number,
  amount: number,
  stripeEventId?: string,
  description?: string
): void {
  transaction(() => {
    const credits = getCredits(userId)
    if (!credits) return

    const totalBefore = credits.subscription_credits + credits.addon_credits
    const newAddonCredits = credits.addon_credits + amount

    updateCredits(userId, credits.subscription_credits, newAddonCredits)

    logCreditEvent(userId, 'addon_purchase', {
      creditsChange: amount,
      creditType: 'addon',
      balanceBefore: totalBefore,
      balanceAfter: credits.subscription_credits + newAddonCredits,
      description: description || `Purchased ${amount} addon credits`,
      stripeEventId,
    })
  })
}

// Expire subscription credits (on cancellation)
export function expireSubscriptionCredits(
  userId: number,
  stripeEventId?: string,
  reason: string = 'Subscription ended'
): void {
  transaction(() => {
    const credits = getCredits(userId)
    if (!credits || credits.subscription_credits === 0) return

    const expiredAmount = credits.subscription_credits
    const totalBefore = credits.subscription_credits + credits.addon_credits

    updateCredits(userId, 0, credits.addon_credits)

    logCreditEvent(userId, 'credits_expired', {
      creditsChange: -expiredAmount,
      creditType: 'subscription',
      balanceBefore: totalBefore,
      balanceAfter: credits.addon_credits,
      description: `${reason}: ${expiredAmount} credits expired`,
      stripeEventId,
    })
  })
}

// Set credits directly (for testing/CLI)
export function setCredits(
  userId: number,
  subscriptionCredits: number,
  addonCredits: number
): void {
  transaction(() => {
    const credits = getCredits(userId)
    if (!credits) return

    const totalBefore = credits.subscription_credits + credits.addon_credits
    updateCredits(userId, subscriptionCredits, addonCredits)

    logCreditEvent(userId, 'manual_adjustment', {
      balanceBefore: totalBefore,
      balanceAfter: subscriptionCredits + addonCredits,
      description: `Manual: set to ${subscriptionCredits} sub + ${addonCredits} addon`,
    })
  })
}
