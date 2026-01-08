/**
 * Setup Stripe Native Products: Meter + Tiered Pricing
 *
 * This script creates:
 * 1. A Stripe Meter for tracking actions
 * 2. Products for each tier with TWO prices:
 *    - License price (flat monthly fee)
 *    - Usage price (tiered metered billing linked to meter)
 *
 * Usage: npm run stripe:setup-native
 */

import Stripe from 'stripe'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

if (!STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY environment variable is not set')
  console.error('')
  console.error('To set it, create a .env.local file with:')
  console.error('  STRIPE_SECRET_KEY=sk_test_...')
  console.error('')
  console.error('Get your test key from: https://dashboard.stripe.com/test/apikeys')
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

// Meter configuration
const METER_CONFIG = {
  displayName: 'Actions',
  eventName: 'action_performed',
}

// Native tier definitions with flat fee + overages
const NATIVE_TIERS = [
  {
    name: 'Native Starter Plan',
    description: 'Flat fee + overage billing: $10/mo with 1 included action, $8/overage',
    licenseFee: 1000, // $10.00 flat fee
    includedActions: 1,
    overageRate: 800, // $8.00 per overage action
    licenseEnvVar: 'STRIPE_NATIVE_STARTER_LICENSE_PRICE_ID',
    usageEnvVar: 'STRIPE_NATIVE_STARTER_USAGE_PRICE_ID',
  },
  {
    name: 'Native Expert Plan',
    description: 'Flat fee + overage billing: $15/mo with 5 included actions, $6/overage',
    licenseFee: 1500, // $15.00 flat fee
    includedActions: 5,
    overageRate: 600, // $6.00 per overage action
    licenseEnvVar: 'STRIPE_NATIVE_EXPERT_LICENSE_PRICE_ID',
    usageEnvVar: 'STRIPE_NATIVE_EXPERT_USAGE_PRICE_ID',
  },
  {
    name: 'Native Pro Plan',
    description: 'Flat fee + overage billing: $20/mo with 10 included actions, $4/overage',
    licenseFee: 2000, // $20.00 flat fee
    includedActions: 10,
    overageRate: 400, // $4.00 per overage action
    licenseEnvVar: 'STRIPE_NATIVE_PRO_LICENSE_PRICE_ID',
    usageEnvVar: 'STRIPE_NATIVE_PRO_USAGE_PRICE_ID',
  },
]

async function findOrCreateMeter(): Promise<Stripe.Billing.Meter> {
  console.log('Setting up Stripe Meter...\n')

  // Check for existing meter
  const existingMeters = await stripe.billing.meters.list({ limit: 100 })
  const existing = existingMeters.data.find(
    (m) => m.event_name === METER_CONFIG.eventName && m.status === 'active'
  )

  if (existing) {
    console.log(`  Found existing meter: ${existing.display_name} (${existing.id})`)
    return existing
  }

  // Create new meter
  const meter = await stripe.billing.meters.create({
    display_name: METER_CONFIG.displayName,
    event_name: METER_CONFIG.eventName,
    default_aggregation: {
      formula: 'sum',
    },
    customer_mapping: {
      type: 'by_id',
      event_payload_key: 'stripe_customer_id',
    },
    value_settings: {
      event_payload_key: 'value',
    },
  })

  console.log(`  Created meter: ${meter.display_name} (${meter.id})`)
  console.log(`    Event name: ${meter.event_name}`)
  console.log(`    Aggregation: sum`)

  return meter
}

async function createProduct(
  name: string,
  description: string,
  metadata: Record<string, string>
): Promise<Stripe.Product> {
  // Check for existing product
  const existingProducts = await stripe.products.list({ limit: 100 })
  const existing = existingProducts.data.find((p) => p.name === name && p.active)

  if (existing) {
    console.log(`  Found existing product: ${name}`)
    return existing
  }

  const product = await stripe.products.create({
    name,
    description,
    metadata,
  })
  console.log(`  Created product: ${name}`)
  return product
}

async function createLicensePrice(
  productId: string,
  amount: number
): Promise<Stripe.Price> {
  // Check for existing license price
  const existingPrices = await stripe.prices.list({ product: productId, limit: 20 })
  const existing = existingPrices.data.find(
    (p) =>
      p.unit_amount === amount &&
      p.active &&
      p.recurring?.interval === 'month' &&
      p.recurring?.usage_type === 'licensed'
  )

  if (existing) {
    console.log(`  Found existing license price: $${(amount / 100).toFixed(2)}/month`)
    return existing
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency: 'usd',
    recurring: {
      interval: 'month',
      usage_type: 'licensed',
    },
    metadata: {
      type: 'native_license',
    },
  })

  console.log(`  Created license price: $${(amount / 100).toFixed(2)}/month`)
  return price
}

async function createTieredUsagePrice(
  productId: string,
  meterId: string,
  includedActions: number,
  overageRate: number
): Promise<Stripe.Price> {
  // Check for existing usage price
  const existingPrices = await stripe.prices.list({ product: productId, limit: 20 })
  const existing = existingPrices.data.find(
    (p) =>
      p.active &&
      p.recurring?.interval === 'month' &&
      p.recurring?.usage_type === 'metered' &&
      p.billing_scheme === 'tiered'
  )

  if (existing) {
    console.log(`  Found existing usage price (tiered metered)`)
    return existing
  }

  // Tiered pricing:
  // Tier 1: 0 to includedActions at $0 (included in flat fee)
  // Tier 2: includedActions+ at overageRate
  const price = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    recurring: {
      interval: 'month',
      usage_type: 'metered',
      meter: meterId,
    },
    billing_scheme: 'tiered',
    tiers_mode: 'graduated',
    tiers: [
      {
        up_to: includedActions,
        unit_amount: 0, // Included actions are free
      },
      {
        up_to: 'inf',
        unit_amount: overageRate, // Overage rate per action
      },
    ],
    metadata: {
      type: 'native_usage',
      included_actions: String(includedActions),
      overage_rate: String(overageRate),
    },
  })

  console.log(
    `  Created usage price: ${includedActions} included @ $0, then $${(overageRate / 100).toFixed(2)}/action`
  )
  return price
}

async function main() {
  console.log('=' .repeat(60))
  console.log('Setting up Stripe Native Products (Flat Fee + Overages)')
  console.log('='.repeat(60) + '\n')

  const envVars: Record<string, string> = {}

  // Step 1: Create or find the meter
  const meter = await findOrCreateMeter()
  envVars['STRIPE_METER_ID'] = meter.id

  // Step 2: Create products and prices for each tier
  console.log('\n\nCreating Products and Prices:')

  for (const tier of NATIVE_TIERS) {
    console.log(`\n${tier.name}:`)

    // Create product
    const product = await createProduct(tier.name, tier.description, {
      type: 'native_subscription',
      included_actions: String(tier.includedActions),
      overage_rate: String(tier.overageRate),
    })

    // Create license price (flat fee)
    const licensePrice = await createLicensePrice(product.id, tier.licenseFee)
    envVars[tier.licenseEnvVar] = licensePrice.id

    // Create usage price (tiered metered)
    const usagePrice = await createTieredUsagePrice(
      product.id,
      meter.id,
      tier.includedActions,
      tier.overageRate
    )
    envVars[tier.usageEnvVar] = usagePrice.id
  }

  // Output environment variables
  console.log('\n\n' + '='.repeat(60))
  console.log('Add these to your .env.local file:')
  console.log('='.repeat(60) + '\n')

  console.log('# Stripe Native (Meters)')
  console.log(`STRIPE_METER_ID=${envVars['STRIPE_METER_ID']}`)
  console.log('')

  for (const tier of NATIVE_TIERS) {
    console.log(`# ${tier.name}`)
    console.log(`${tier.licenseEnvVar}=${envVars[tier.licenseEnvVar]}`)
    console.log(`${tier.usageEnvVar}=${envVars[tier.usageEnvVar]}`)
    console.log('')
  }

  console.log('='.repeat(60))
  console.log('Setup complete!')
  console.log('')
  console.log('Next steps:')
  console.log('1. Copy the environment variables above to .env.local')
  console.log('2. Set STRIPE_NATIVE_WEBHOOK_SECRET for /api/native/webhooks/stripe')
  console.log('3. Run: stripe listen --forward-to localhost:3000/api/native/webhooks/stripe')
  console.log('4. Test at: http://localhost:3000/native')
  console.log('='.repeat(60))
}

main().catch(console.error)
