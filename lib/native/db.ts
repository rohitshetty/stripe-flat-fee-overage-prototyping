/**
 * Native Implementation: Database Functions
 *
 * SIMPLICITY: Only 3 tables vs 5 tables in credits implementation.
 * No credits table, no credit_log table - Stripe tracks all usage.
 *
 * Compare to: lib/db.ts (~200 lines for credits-related queries)
 * This file: ~60 lines
 */

import { getDb } from '../db'

// Types
export interface NativeUser {
  id: number
  email: string
  stripe_customer_id: string | null
  created_at: string
}

export interface NativeSubscription {
  id: number
  user_id: number
  stripe_subscription_id: string | null
  tier: 'starter' | 'expert' | 'pro'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'none'
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface NativeActionLogEntry {
  id: number
  user_id: number
  stripe_meter_event_id: string | null
  created_at: string
}

// User queries
export function getNativeUser(id: number = 1): NativeUser | undefined {
  return getDb()
    .prepare('SELECT * FROM native_users WHERE id = ?')
    .get(id) as NativeUser | undefined
}

export function updateNativeUserStripeCustomerId(userId: number, stripeCustomerId: string) {
  return getDb()
    .prepare('UPDATE native_users SET stripe_customer_id = ? WHERE id = ?')
    .run(stripeCustomerId, userId)
}

// Subscription queries
export function getNativeSubscription(userId: number = 1): NativeSubscription | undefined {
  return getDb()
    .prepare('SELECT * FROM native_subscriptions WHERE user_id = ?')
    .get(userId) as NativeSubscription | undefined
}

export function upsertNativeSubscription(
  userId: number,
  data: Partial<Omit<NativeSubscription, 'id' | 'user_id' | 'created_at'>>
) {
  const existing = getNativeSubscription(userId)

  if (existing) {
    const fields = Object.keys(data)
      .map((key) => `${key} = @${key}`)
      .join(', ')

    return getDb()
      .prepare(
        `UPDATE native_subscriptions SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = @user_id`
      )
      .run({ ...data, user_id: userId })
  } else {
    const fields = ['user_id', ...Object.keys(data)]
    const placeholders = fields.map((f) => `@${f}`).join(', ')

    return getDb()
      .prepare(`INSERT INTO native_subscriptions (${fields.join(', ')}) VALUES (${placeholders})`)
      .run({ user_id: userId, ...data })
  }
}

// Action log queries (optional - for UI responsiveness only)
export function logNativeAction(userId: number, meterEventId?: string) {
  return getDb()
    .prepare('INSERT INTO native_action_log (user_id, stripe_meter_event_id) VALUES (?, ?)')
    .run(userId, meterEventId || null)
}

export function getNativeActionLog(userId: number = 1, limit: number = 50): NativeActionLogEntry[] {
  return getDb()
    .prepare(
      'SELECT * FROM native_action_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(userId, limit) as NativeActionLogEntry[]
}

export function getNativeActionCount(userId: number = 1): number {
  const result = getDb()
    .prepare('SELECT COUNT(*) as count FROM native_action_log WHERE user_id = ?')
    .get(userId) as { count: number }
  return result?.count ?? 0
}
