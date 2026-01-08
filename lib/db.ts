import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.DATABASE_PATH || './data/prototype.db'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.resolve(process.cwd(), DB_PATH)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

// User queries
export function getUser(id: number = 1) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as {
    id: number
    email: string
    stripe_customer_id: string | null
    created_at: string
  } | undefined
}

export function updateUserStripeCustomerId(userId: number, stripeCustomerId: string) {
  return getDb()
    .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
    .run(stripeCustomerId, userId)
}

// Subscription queries
export interface Subscription {
  id: number
  user_id: number
  stripe_subscription_id: string | null
  tier: 'starter' | 'expert' | 'pro'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'none'
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_end: string | null
  created_at: string
  updated_at: string
}

export function getSubscription(userId: number = 1): Subscription | undefined {
  return getDb()
    .prepare('SELECT * FROM subscriptions WHERE user_id = ?')
    .get(userId) as Subscription | undefined
}

export function upsertSubscription(
  userId: number,
  data: Partial<Omit<Subscription, 'id' | 'user_id' | 'created_at'>>
) {
  const existing = getSubscription(userId)

  // Convert booleans to integers for SQLite
  const sqlData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    sqlData[key] = typeof value === 'boolean' ? (value ? 1 : 0) : value
  }

  if (existing) {
    const fields = Object.keys(sqlData)
      .map(key => `${key} = @${key}`)
      .join(', ')

    return getDb()
      .prepare(`UPDATE subscriptions SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = @user_id`)
      .run({ ...sqlData, user_id: userId })
  } else {
    const fields = ['user_id', ...Object.keys(sqlData)]
    const placeholders = fields.map(f => `@${f}`).join(', ')

    return getDb()
      .prepare(`INSERT INTO subscriptions (${fields.join(', ')}) VALUES (${placeholders})`)
      .run({ user_id: userId, ...sqlData })
  }
}

// Credit queries
export interface Credits {
  id: number
  user_id: number
  subscription_credits: number
  addon_credits: number
  updated_at: string
}

export function getCredits(userId: number = 1): Credits | undefined {
  return getDb()
    .prepare('SELECT * FROM credits WHERE user_id = ?')
    .get(userId) as Credits | undefined
}

export function updateCredits(
  userId: number,
  subscriptionCredits: number,
  addonCredits: number
) {
  return getDb()
    .prepare(
      `UPDATE credits SET subscription_credits = ?, addon_credits = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
    )
    .run(subscriptionCredits, addonCredits, userId)
}

// Credit log queries
export interface CreditLogEntry {
  id: number
  user_id: number
  event_type: string
  credits_change: number | null
  credit_type: 'subscription' | 'addon' | null
  balance_before: number | null
  balance_after: number | null
  description: string | null
  stripe_event_id: string | null
  created_at: string
}

export function logCreditEvent(
  userId: number,
  eventType: string,
  data: {
    creditsChange?: number
    creditType?: 'subscription' | 'addon'
    balanceBefore?: number
    balanceAfter?: number
    description?: string
    stripeEventId?: string
  }
) {
  return getDb()
    .prepare(
      `INSERT INTO credit_log (user_id, event_type, credits_change, credit_type, balance_before, balance_after, description, stripe_event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      eventType,
      data.creditsChange ?? null,
      data.creditType ?? null,
      data.balanceBefore ?? null,
      data.balanceAfter ?? null,
      data.description ?? null,
      data.stripeEventId ?? null
    )
}

export function getCreditLog(userId: number = 1, limit: number = 50): CreditLogEntry[] {
  return getDb()
    .prepare('SELECT * FROM credit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit) as CreditLogEntry[]
}

export function hasProcessedStripeEvent(stripeEventId: string): boolean {
  const result = getDb()
    .prepare('SELECT 1 FROM credit_log WHERE stripe_event_id = ? LIMIT 1')
    .get(stripeEventId)
  return !!result
}

// Actions queries
export interface Actions {
  id: number
  user_id: number
  total_count: number
}

export function getActions(userId: number = 1): Actions | undefined {
  return getDb()
    .prepare('SELECT * FROM actions WHERE user_id = ?')
    .get(userId) as Actions | undefined
}

export function incrementActionCount(userId: number = 1) {
  return getDb()
    .prepare('UPDATE actions SET total_count = total_count + 1 WHERE user_id = ?')
    .run(userId)
}

// Transaction helper
export function transaction<T>(fn: () => T): T {
  return getDb().transaction(fn)()
}
