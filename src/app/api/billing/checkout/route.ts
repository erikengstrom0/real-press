/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for subscription upgrade.
 * Requires session auth (logged-in user).
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createCheckoutSession } from '@/lib/services/billing.service'

const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID
const ENTERPRISE_PRICE_ID = process.env.STRIPE_ENTERPRISE_PRICE_ID
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: { priceId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { priceId } = body
  if (!priceId) {
    return NextResponse.json({ error: 'priceId is required' }, { status: 400 })
  }

  // Validate priceId is one of our known price IDs
  if (priceId !== PRO_PRICE_ID && priceId !== ENTERPRISE_PRICE_ID) {
    return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
  }

  try {
    const url = await createCheckoutSession(
      session.user.id,
      priceId,
      `${APP_URL}/profile?billing=success`,
      `${APP_URL}/profile?billing=cancel`
    )

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
