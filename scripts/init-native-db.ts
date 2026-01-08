/**
 * Native Implementation: Database Initialization
 *
 * SIMPLICITY: Only 3 tables vs 5 tables in credits implementation.
 * - No credits table (Stripe tracks usage)
 * - No credit_log table (Stripe has usage records)
 *
 * Compare to: scripts/init-db.ts
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DATABASE_PATH || './data/prototype.db'
const dbPath = path.resolve(process.cwd(), DB_PATH)
const dbDir = path.dirname(dbPath)

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
  console.log(`Created directory: ${dbDir}`)
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('Initializing native tables...\n')

// Create native tables (adds to existing database, doesn't replace)
db.exec(`
  -- Native: Single user for prototype (no auth)
  CREATE TABLE IF NOT EXISTS native_users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL DEFAULT 'test@example.com',
    stripe_customer_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Native: Subscription state (minimal - Stripe is source of truth)
  -- Note: No cancel_at_period_end, no trial_end - simpler schema
  CREATE TABLE IF NOT EXISTS native_subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stripe_subscription_id TEXT,
    tier TEXT NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'none',
    current_period_start DATETIME,
    current_period_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES native_users(id)
  );

  -- Native: Local action log (for UI responsiveness only, NOT billing source of truth)
  -- Note: No credits_change, balance_before, balance_after - Stripe tracks this
  CREATE TABLE IF NOT EXISTS native_action_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stripe_meter_event_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES native_users(id)
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_native_subscriptions_user_id ON native_subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_native_action_log_user_id ON native_action_log(user_id);
`)

console.log('Native tables created:')
console.log('  - native_users (3 columns)')
console.log('  - native_subscriptions (8 columns)')
console.log('  - native_action_log (4 columns)')
console.log('')
console.log('Compare to credits implementation:')
console.log('  - 5 tables with ~45 columns total')
console.log('  - Native: 3 tables with ~15 columns total')
console.log('')

// Generate random email
const randomId = Math.random().toString(36).substring(2, 8)
const randomEmail = `test-${randomId}@example.com`

// Reset user data - delete existing and create fresh
db.exec(`
  DELETE FROM native_action_log WHERE user_id = 1;
  DELETE FROM native_subscriptions WHERE user_id = 1;
  DELETE FROM native_users WHERE id = 1;
`)

db.exec(`
  INSERT INTO native_users (id, email) VALUES (1, '${randomEmail}');
  INSERT INTO native_subscriptions (user_id, tier, status) VALUES (1, 'starter', 'none');
`)

console.log('Test user created (fresh):')
console.log(`  - ID: 1`)
console.log(`  - Email: ${randomEmail}`)
console.log('  - Status: No subscription')

console.log('')
console.log(`Native tables initialized in: ${dbPath}`)

db.close()
