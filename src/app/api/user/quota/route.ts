/**
 * GET /api/user/quota
 *
 * Returns the current monthly quota status for the authenticated user.
 * Requires NextAuth session authentication.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserTier } from '@/lib/api/check-tier'
import { getQuotaStatus } from '@/lib/services/quota.service'

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const tier = await getUserTier(session.user.id)
  const status = await getQuotaStatus(session.user.id, tier)

  return NextResponse.json(status)
}
