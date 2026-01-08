/**
 * Native Implementation: Tier Definitions with Two-Part Pricing
 *
 * Each tier has:
 * - License fee (flat monthly charge)
 * - Usage price (tiered metered billing)
 *
 * Compare to: lib/constants.ts (single price per tier)
 */

// Native tier definitions with TWO prices per tier (license + usage)
export const NATIVE_TIERS = {
  starter: {
    name: 'Starter',
    licenseFee: 1000, // $10.00 flat fee in cents
    includedActions: 1,
    overageRate: 800, // $8.00 per overage action in cents
    licensePriceId: process.env.STRIPE_NATIVE_STARTER_LICENSE_PRICE_ID || '',
    usagePriceId: process.env.STRIPE_NATIVE_STARTER_USAGE_PRICE_ID || '',
  },
  expert: {
    name: 'Expert',
    licenseFee: 1500, // $15.00 flat fee in cents
    includedActions: 5,
    overageRate: 600, // $6.00 per overage action in cents
    licensePriceId: process.env.STRIPE_NATIVE_EXPERT_LICENSE_PRICE_ID || '',
    usagePriceId: process.env.STRIPE_NATIVE_EXPERT_USAGE_PRICE_ID || '',
  },
  pro: {
    name: 'Pro',
    licenseFee: 2000, // $20.00 flat fee in cents
    includedActions: 10,
    overageRate: 400, // $4.00 per overage action in cents
    licensePriceId: process.env.STRIPE_NATIVE_PRO_LICENSE_PRICE_ID || '',
    usagePriceId: process.env.STRIPE_NATIVE_PRO_USAGE_PRICE_ID || '',
  },
} as const

export type NativeTierName = keyof typeof NATIVE_TIERS

// Trial settings (same as credits implementation)
export const TRIAL_DAYS = 14
export const TRIAL_TIER: NativeTierName = 'starter'

// Stripe Meter ID for usage tracking
export const METER_ID = process.env.STRIPE_METER_ID || ''
export const METER_EVENT_NAME = 'action_performed'

// Get included actions for a tier
export function getNativeTierIncludedActions(tier: NativeTierName): number {
  return NATIVE_TIERS[tier]?.includedActions ?? 0
}

// Get overage rate for a tier (in cents)
export function getNativeTierOverageRate(tier: NativeTierName): number {
  return NATIVE_TIERS[tier]?.overageRate ?? 0
}

// Get license fee for a tier (in cents)
export function getNativeTierLicenseFee(tier: NativeTierName): number {
  return NATIVE_TIERS[tier]?.licenseFee ?? 0
}

// Get tier name from license price ID
export function getNativeTierFromLicensePriceId(priceId: string): NativeTierName | null {
  for (const [tier, config] of Object.entries(NATIVE_TIERS)) {
    if (config.licensePriceId === priceId) {
      return tier as NativeTierName
    }
  }
  return null
}

// Get tier name from usage price ID
export function getNativeTierFromUsagePriceId(priceId: string): NativeTierName | null {
  for (const [tier, config] of Object.entries(NATIVE_TIERS)) {
    if (config.usagePriceId === priceId) {
      return tier as NativeTierName
    }
  }
  return null
}

// Get tier from any price ID (license or usage)
export function getNativeTierFromPriceId(priceId: string): NativeTierName | null {
  return getNativeTierFromLicensePriceId(priceId) || getNativeTierFromUsagePriceId(priceId)
}

// Subscription statuses that allow actions
export const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'] as const
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number]

// Check if subscription status allows actions
export function canPerformActions(status: string): boolean {
  return ACTIVE_STATUSES.includes(status as ActiveStatus)
}
