#!/usr/bin/env npx tsx

import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

import {
  getUser,
  getSubscription,
  getCredits,
  getActions,
  getCreditLog,
  getDb,
  closeDb,
} from '../lib/db'
import { setCredits, addAddonCredits, getCreditBalance } from '../lib/credits'
import { setSubscription, getSubscriptionInfo, SubscriptionStatus } from '../lib/subscriptions'
import { TierName, TIERS, ADDONS } from '../lib/constants'

const args = process.argv.slice(2)
const command = args[0]

function printHelp() {
  console.log(`
Subscription Prototype CLI

Usage: npm run cli <command> [options]

Commands:
  status                        Show current user state, credits, subscription
  reset                         Wipe all data, reinitialize test user
  set-credits <sub> <addon>     Set credit balances (e.g., set-credits 5 3)
  set-subscription <tier> <status>  Set subscription tier and status
  add-addon-credits <amount>    Add addon credits directly
  list-events [limit]           Show credit_log entries (default: 20)
  clear-events                  Clear all credit_log entries
  help                          Show this help message

Tiers: starter, expert, pro
Statuses: none, trialing, active, past_due, canceled

Examples:
  npm run cli status
  npm run cli reset
  npm run cli set-credits 10 5
  npm run cli set-subscription pro active
  npm run cli add-addon-credits 10
  npm run cli list-events 50
`)
}

function printStatus() {
  const user = getUser(1)
  const subscription = getSubscriptionInfo(1)
  const credits = getCreditBalance(1)
  const actions = getActions(1)

  console.log('\n=== User Status ===')
  console.log(`Email: ${user?.email ?? 'Not found'}`)
  console.log(`Stripe Customer ID: ${user?.stripe_customer_id ?? 'None'}`)

  console.log('\n=== Subscription ===')
  console.log(`Tier: ${subscription.tier}`)
  console.log(`Status: ${subscription.status}`)
  if (subscription.currentPeriodEnd) {
    console.log(`Period End: ${subscription.currentPeriodEnd.toLocaleDateString()}`)
  }
  if (subscription.daysUntilRenewal !== null) {
    console.log(`Days Until Renewal: ${subscription.daysUntilRenewal}`)
  }
  if (subscription.cancelAtPeriodEnd) {
    console.log(`Cancel At Period End: Yes`)
  }
  if (subscription.isInGracePeriod) {
    console.log(`Grace Period: Active (ends ${subscription.gracePeriodEndsAt?.toLocaleDateString()})`)
  }

  console.log('\n=== Credits ===')
  console.log(`Subscription Credits: ${credits.subscriptionCredits}`)
  console.log(`Add-on Credits: ${credits.addonCredits}`)
  console.log(`Total: ${credits.totalCredits}`)

  console.log('\n=== Actions ===')
  console.log(`Total Actions Performed: ${actions?.total_count ?? 0}`)
  console.log('')
}

function reset() {
  console.log('Resetting database...')

  const db = getDb()

  // Clear all tables
  db.exec(`
    DELETE FROM credit_log;
    DELETE FROM actions;
    DELETE FROM credits;
    DELETE FROM subscriptions;
    DELETE FROM users;
  `)

  // Reinitialize test user
  db.exec(`
    INSERT INTO users (id, email) VALUES (1, 'test@example.com');
    INSERT INTO subscriptions (user_id, tier, status) VALUES (1, 'starter', 'none');
    INSERT INTO credits (user_id, subscription_credits, addon_credits) VALUES (1, 0, 0);
    INSERT INTO actions (user_id, total_count) VALUES (1, 0);
  `)

  console.log('Database reset complete.')
  console.log('Test user created with:')
  console.log('  - No subscription')
  console.log('  - 0 credits')
  console.log('  - 0 actions')
}

function setCreditsCommand(subCredits: string, addonCredits: string) {
  const sub = parseInt(subCredits, 10)
  const addon = parseInt(addonCredits, 10)

  if (isNaN(sub) || isNaN(addon)) {
    console.error('Error: Credits must be numbers')
    process.exit(1)
  }

  if (sub < 0 || addon < 0) {
    console.error('Error: Credits cannot be negative')
    process.exit(1)
  }

  setCredits(1, sub, addon)
  console.log(`Credits set to: ${sub} subscription, ${addon} addon`)
}

function setSubscriptionCommand(tier: string, status: string) {
  const validTiers: TierName[] = ['starter', 'expert', 'pro']
  const validStatuses: SubscriptionStatus[] = ['none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid']

  if (!validTiers.includes(tier as TierName)) {
    console.error(`Error: Invalid tier. Valid tiers: ${validTiers.join(', ')}`)
    process.exit(1)
  }

  if (!validStatuses.includes(status as SubscriptionStatus)) {
    console.error(`Error: Invalid status. Valid statuses: ${validStatuses.join(', ')}`)
    process.exit(1)
  }

  setSubscription(1, tier as TierName, status as SubscriptionStatus)
  console.log(`Subscription set to: ${tier} (${status})`)

  // If setting to active or trialing, also allocate credits
  if (status === 'active' || status === 'trialing') {
    const tierCredits = TIERS[tier as TierName].credits
    setCredits(1, tierCredits, getCreditBalance(1).addonCredits)
    console.log(`Allocated ${tierCredits} subscription credits for ${tier} tier`)
  }
}

function addAddonCreditsCommand(amount: string) {
  const credits = parseInt(amount, 10)

  if (isNaN(credits) || credits <= 0) {
    console.error('Error: Amount must be a positive number')
    process.exit(1)
  }

  addAddonCredits(1, credits, undefined, `CLI: Added ${credits} addon credits`)
  console.log(`Added ${credits} addon credits`)
}

function listEvents(limit: string = '20') {
  const limitNum = parseInt(limit, 10) || 20
  const events = getCreditLog(1, limitNum)

  if (events.length === 0) {
    console.log('\nNo events found.')
    return
  }

  console.log(`\n=== Credit Log (last ${events.length} events) ===\n`)

  for (const event of events) {
    const date = new Date(event.created_at).toLocaleString()
    const change = event.credits_change !== null
      ? `${event.credits_change > 0 ? '+' : ''}${event.credits_change}`
      : ''

    console.log(`[${date}] ${event.event_type}`)
    if (event.description) {
      console.log(`  ${event.description}`)
    }
    if (change) {
      console.log(`  Credits: ${change} (${event.balance_before} → ${event.balance_after})`)
    }
    console.log('')
  }
}

function clearEvents() {
  const db = getDb()
  db.exec('DELETE FROM credit_log')
  console.log('Credit log cleared.')
}

// Main
async function main() {
  try {
    switch (command) {
      case 'status':
        printStatus()
        break

      case 'reset':
        reset()
        break

      case 'set-credits':
        if (args.length < 3) {
          console.error('Usage: npm run cli set-credits <subscription> <addon>')
          process.exit(1)
        }
        setCreditsCommand(args[1], args[2])
        break

      case 'set-subscription':
        if (args.length < 3) {
          console.error('Usage: npm run cli set-subscription <tier> <status>')
          process.exit(1)
        }
        setSubscriptionCommand(args[1], args[2])
        break

      case 'add-addon-credits':
        if (args.length < 2) {
          console.error('Usage: npm run cli add-addon-credits <amount>')
          process.exit(1)
        }
        addAddonCreditsCommand(args[1])
        break

      case 'list-events':
        listEvents(args[1])
        break

      case 'clear-events':
        clearEvents()
        break

      case 'help':
      case '--help':
      case '-h':
        printHelp()
        break

      default:
        if (command) {
          console.error(`Unknown command: ${command}`)
        }
        printHelp()
        process.exit(command ? 1 : 0)
    }
  } finally {
    closeDb()
  }
}

main().catch((error) => {
  console.error('Error:', error)
  closeDb()
  process.exit(1)
})
