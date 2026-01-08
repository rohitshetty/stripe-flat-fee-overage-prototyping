/**
 * Native Implementation: Portal Endpoint
 *
 * Creates Stripe Customer Portal session.
 * Identical to credits version - reuses existing helper.
 */

import { NextResponse } from 'next/server'
import { getNativeUser } from '@/lib/native/db'
import { createPortalSession } from '@/lib/stripe'

export async function GET() {
  try {
    const userId = 1 // Single user prototype
    const user = getNativeUser(userId)

    if (!user?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer configured' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const session = await createPortalSession(
      user.stripe_customer_id,
      `${appUrl}/native`
    )

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[api/native/portal] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
