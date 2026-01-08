/**
 * Native Implementation: Stripe Meter Integration
 *
 * SIMPLICITY: This is the ENTIRE usage tracking implementation.
 * Stripe Meters handle:
 * - Usage aggregation
 * - Billing calculation
 * - Period resets
 * - Invoice line items
 *
 * Lines of code: ~45
 * Test cases needed: ~3
 * Edge cases handled: 0 (Stripe handles them)
 *
 * Compare to: lib/credits.ts (258 lines)
 * - No locks needed
 * - No credit type priority
 * - No balance management
 * - No expiration logic
 */

import { stripe } from '../stripe'
import { METER_ID, METER_EVENT_NAME } from './constants'

export interface RecordActionResult {
  success: boolean
  meterEventId?: string
  error?: string
}

export interface UsageSummary {
  totalActions: number
  error?: string
}

/**
 * Record an action by sending a meter event to Stripe.
 *
 * This single function replaces the entire useCredit() flow in lib/credits.ts:
 * - No transaction/lock needed
 * - No credit balance check
 * - No credit type priority (subscription vs addon)
 * - No balance update
 * - No audit logging
 */
export async function recordAction(stripeCustomerId: string): Promise<RecordActionResult> {
  if (!METER_ID) {
    return { success: false, error: 'Meter ID not configured' }
  }

  try {
    const meterEvent = await stripe.billing.meterEvents.create({
      event_name: METER_EVENT_NAME,
      timestamp: Math.floor(Date.now() / 1000), // Unix timestamp
      payload: {
        stripe_customer_id: stripeCustomerId,
        value: '1',
      },
    })

    return {
      success: true,
      meterEventId: meterEvent.identifier,
    }
  } catch (error) {
    console.error('[native/meter] Failed to record meter event:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record action',
    }
  }
}

/**
 * Get current usage from Stripe meter for a billing period.
 *
 * This queries Stripe directly - no local state to sync.
 */
export async function getCurrentUsage(
  stripeCustomerId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<UsageSummary> {
  if (!METER_ID) {
    return { totalActions: 0, error: 'Meter ID not configured' }
  }

  try {
    const summary = await stripe.billing.meters.listEventSummaries(METER_ID, {
      customer: stripeCustomerId,
      start_time: Math.floor(periodStart.getTime() / 1000),
      end_time: Math.floor(periodEnd.getTime() / 1000),
    })

    return {
      totalActions: summary.data[0]?.aggregated_value ?? 0,
    }
  } catch (error) {
    console.error('[native/meter] Failed to get usage:', error)
    return {
      totalActions: 0,
      error: error instanceof Error ? error.message : 'Failed to get usage',
    }
  }
}
