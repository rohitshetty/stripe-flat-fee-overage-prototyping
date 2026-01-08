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

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath)
  console.log(`Removed existing database: ${dbPath}`)
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('Initializing database...\n')

// Create tables
db.exec(`
  -- Single user for prototype (no auth)
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL DEFAULT 'test@example.com',
    stripe_customer_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Subscription state (source of truth: Stripe, cached locally)
  CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stripe_subscription_id TEXT,
    tier TEXT NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'none',
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    trial_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Credit balances (separate tracking for subscription vs add-on)
  CREATE TABLE credits (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    subscription_credits INTEGER DEFAULT 0,
    addon_credits INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Audit log for credits and billing events
  CREATE TABLE credit_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    credits_change INTEGER,
    credit_type TEXT,
    balance_before INTEGER,
    balance_after INTEGER,
    description TEXT,
    stripe_event_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Action counter (the visible counter for "clicks")
  CREATE TABLE actions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Indexes for performance
  CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
  CREATE INDEX idx_credits_user_id ON credits(user_id);
  CREATE INDEX idx_credit_log_user_id ON credit_log(user_id);
  CREATE INDEX idx_credit_log_stripe_event_id ON credit_log(stripe_event_id);
  CREATE INDEX idx_actions_user_id ON actions(user_id);
`)

console.log('Tables created successfully.')

// Insert test user
db.exec(`
  INSERT INTO users (id, email) VALUES (1, 'test@example.com');
  INSERT INTO subscriptions (user_id, tier, status) VALUES (1, 'starter', 'none');
  INSERT INTO credits (user_id, subscription_credits, addon_credits) VALUES (1, 0, 0);
  INSERT INTO actions (user_id, total_count) VALUES (1, 0);
`)

console.log('Test user created:')
console.log('  - ID: 1')
console.log('  - Email: test@example.com')
console.log('  - Status: No subscription')
console.log('  - Credits: 0 subscription, 0 add-on')
console.log('')
console.log(`Database initialized at: ${dbPath}`)

db.close()
