// Subscription tier definitions
export const TIERS = {
  starter: {
    name: 'Starter',
    price: 1000, // $10.00 in cents
    credits: 1,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
  },
  expert: {
    name: 'Expert',
    price: 1500, // $15.00 in cents
    credits: 5,
    priceId: process.env.STRIPE_EXPERT_PRICE_ID || '',
  },
  pro: {
    name: 'Pro',
    price: 2000, // $20.00 in cents
    credits: 10,
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
  },
} as const

export type TierName = keyof typeof TIERS

// Add-on credit pack definitions
export const ADDONS = {
  small: {
    name: 'Small Credit Pack',
    price: 2500, // $25.00 in cents
    credits: 3,
    priceId: process.env.STRIPE_ADDON_SMALL_PRICE_ID || '',
  },
  medium: {
    name: 'Medium Credit Pack',
    price: 7000, // $70.00 in cents
    credits: 10,
    priceId: process.env.STRIPE_ADDON_MEDIUM_PRICE_ID || '',
  },
  large: {
    name: 'Large Credit Pack',
    price: 15000, // $150.00 in cents
    credits: 25,
    priceId: process.env.STRIPE_ADDON_LARGE_PRICE_ID || '',
  },
} as const

export type AddonName = keyof typeof ADDONS

// Trial settings
export const TRIAL_DAYS = 14
export const TRIAL_TIER: TierName = 'starter'

// Grace period for failed payments
export const GRACE_PERIOD_DAYS = 7

// Get credits for a tier
export function getTierCredits(tier: TierName): number {
  return TIERS[tier]?.credits ?? 0
}

// Get tier name from price ID
export function getTierFromPriceId(priceId: string): TierName | null {
  for (const [tier, config] of Object.entries(TIERS)) {
    if (config.priceId === priceId) {
      return tier as TierName
    }
  }
  return null
}

// Get addon name from price ID
export function getAddonFromPriceId(priceId: string): AddonName | null {
  for (const [addon, config] of Object.entries(ADDONS)) {
    if (config.priceId === priceId) {
      return addon as AddonName
    }
  }
  return null
}

// Get addon credits from price ID
export function getAddonCredits(priceId: string): number {
  const addon = getAddonFromPriceId(priceId)
  return addon ? ADDONS[addon].credits : 0
}

// Check if a price ID is a subscription
export function isSubscriptionPriceId(priceId: string): boolean {
  return getTierFromPriceId(priceId) !== null
}

// Check if a price ID is an addon
export function isAddonPriceId(priceId: string): boolean {
  return getAddonFromPriceId(priceId) !== null
}

// Subscription statuses that allow credit usage
export const USABLE_STATUSES = ['trialing', 'active', 'past_due'] as const
export type UsableStatus = typeof USABLE_STATUSES[number]

// Check if subscription status allows credit usage
export function canUseCredits(status: string): boolean {
  return USABLE_STATUSES.includes(status as UsableStatus)
}
