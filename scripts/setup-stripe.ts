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

// Product and price definitions
const SUBSCRIPTION_PRODUCTS = [
  {
    name: 'Starter Plan',
    description: 'Basic subscription with 1 credit per month',
    price: 1000, // $10.00
    credits: 1,
    envVar: 'STRIPE_STARTER_PRICE_ID',
  },
  {
    name: 'Expert Plan',
    description: 'Professional subscription with 5 credits per month',
    price: 1500, // $15.00
    credits: 5,
    envVar: 'STRIPE_EXPERT_PRICE_ID',
  },
  {
    name: 'Pro Plan',
    description: 'Premium subscription with 10 credits per month',
    price: 2000, // $20.00
    credits: 10,
    envVar: 'STRIPE_PRO_PRICE_ID',
  },
]

const ADDON_PRODUCTS = [
  {
    name: 'Small Credit Pack',
    description: '3 credits that never expire',
    price: 2500, // $25.00
    credits: 3,
    envVar: 'STRIPE_ADDON_SMALL_PRICE_ID',
  },
  {
    name: 'Medium Credit Pack',
    description: '10 credits that never expire',
    price: 7000, // $70.00
    credits: 10,
    envVar: 'STRIPE_ADDON_MEDIUM_PRICE_ID',
  },
  {
    name: 'Large Credit Pack',
    description: '25 credits that never expire',
    price: 15000, // $150.00
    credits: 25,
    envVar: 'STRIPE_ADDON_LARGE_PRICE_ID',
  },
]

async function createProduct(
  name: string,
  description: string,
  metadata: Record<string, string>
): Promise<Stripe.Product> {
  // Check for existing product
  const existingProducts = await stripe.products.list({ limit: 100 })
  const existing = existingProducts.data.find(p => p.name === name && p.active)

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

async function createPrice(
  productId: string,
  amount: number,
  recurring: boolean,
  metadata: Record<string, string>
): Promise<Stripe.Price> {
  // Check for existing price
  const existingPrices = await stripe.prices.list({ product: productId, limit: 10 })
  const existing = existingPrices.data.find(
    p => p.unit_amount === amount && p.active &&
    (recurring ? p.recurring?.interval === 'month' : !p.recurring)
  )

  if (existing) {
    console.log(`  Found existing price: $${(amount / 100).toFixed(2)}`)
    return existing
  }

  const priceParams: Stripe.PriceCreateParams = {
    product: productId,
    unit_amount: amount,
    currency: 'usd',
    metadata,
  }

  if (recurring) {
    priceParams.recurring = { interval: 'month' }
  }

  const price = await stripe.prices.create(priceParams)
  console.log(`  Created price: $${(amount / 100).toFixed(2)}${recurring ? '/month' : ' (one-time)'}`)
  return price
}

async function main() {
  console.log('Setting up Stripe products and prices...\n')

  const envVars: Record<string, string> = {}

  // Create subscription products
  console.log('Subscription Products:')
  for (const product of SUBSCRIPTION_PRODUCTS) {
    console.log(`\n${product.name}:`)
    const stripeProduct = await createProduct(
      product.name,
      product.description,
      { credits: String(product.credits), type: 'subscription' }
    )

    const stripePrice = await createPrice(
      stripeProduct.id,
      product.price,
      true,
      { credits: String(product.credits) }
    )

    envVars[product.envVar] = stripePrice.id
  }

  // Create addon products
  console.log('\n\nAdd-on Products:')
  for (const product of ADDON_PRODUCTS) {
    console.log(`\n${product.name}:`)
    const stripeProduct = await createProduct(
      product.name,
      product.description,
      { credits: String(product.credits), type: 'addon' }
    )

    const stripePrice = await createPrice(
      stripeProduct.id,
      product.price,
      false,
      { credits: String(product.credits) }
    )

    envVars[product.envVar] = stripePrice.id
  }

  // Output environment variables
  console.log('\n\n' + '='.repeat(60))
  console.log('Add these to your .env.local file:')
  console.log('='.repeat(60) + '\n')

  for (const [key, value] of Object.entries(envVars)) {
    console.log(`${key}=${value}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Setup complete!')
  console.log('='.repeat(60))
}

main().catch(console.error)
