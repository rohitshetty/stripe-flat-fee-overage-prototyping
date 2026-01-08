import { NextResponse } from 'next/server'
import { useCredit } from '@/lib/credits'

export async function POST() {
  try {
    const userId = 1 // Single user prototype

    const result = useCredit(userId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      credits: {
        subscription: result.balance!.subscriptionCredits,
        addon: result.balance!.addonCredits,
        total: result.balance!.totalCredits,
      },
      actionCount: result.actionCount,
    })
  } catch (error) {
    console.error('Error using credit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
