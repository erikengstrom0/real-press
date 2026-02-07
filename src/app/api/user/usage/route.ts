/**
 * GET /api/user/usage
 *
 * Returns usage statistics for the authenticated user.
 * Query params: ?days=30 (default 30, max 90), ?keyId=<id> (optional filter)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUsageStats, getUsageByKey } from '@/lib/services/usage.service'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  let days = parseInt(searchParams.get('days') || '30', 10)
  if (isNaN(days) || days < 1) days = 30
  if (days > 90) days = 90

  const keyId = searchParams.get('keyId')

  try {
    const usage = keyId
      ? await getUsageByKey(session.user.id, keyId, days)
      : await getUsageStats(session.user.id, days)

    return NextResponse.json({ usage })
  } catch (error) {
    console.error('Usage stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    )
  }
}
