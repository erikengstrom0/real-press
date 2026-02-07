/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for managing subscriptions.
 * Requires session auth and an existing Stripe customer.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createPortalSession } from '@/lib/services/billing.service'
import prisma from '@/lib/db/prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // Check user has a Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing account found. Please subscribe first.' },
      { status: 400 }
    )
  }

  try {
    const url = await createPortalSession(
      session.user.id,
      `${APP_URL}/profile`
    )

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Portal session error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
