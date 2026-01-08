import { NextResponse } from 'next/server'
import { getUser } from '@/lib/db'
import { createPortalSession } from '@/lib/stripe'

export async function GET() {
  try {
    const userId = 1 // Single user prototype
    const user = getUser(userId)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!user.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await createPortalSession(
      user.stripe_customer_id,
      appUrl
    )

    return NextResponse.json({
      url: session.url,
    })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
