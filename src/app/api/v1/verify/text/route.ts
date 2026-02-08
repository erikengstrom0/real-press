/**
 * POST /api/v1/verify/text
 *
 * Verify text content for AI detection.
 * Accepts 50-50000 characters of text, returns score formatted per tier.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { verifyAuth, isAuthError, quotaHeaders } from '@/lib/api/verify-auth'
import { detectAIContent } from '@/lib/ai-detection'
import { hasBreakdownAccess } from '@/lib/api/check-tier'
import { formatFreeResponse, formatPaidResponse } from '@/lib/ai-detection/format-breakdown'
import { buildAiScoreRowFromComposite } from '../_lib/build-score-row'
import { recordApiUsage } from '@/lib/services/quota.service'

const requestSchema = z.object({
  text: z.string().min(50, 'Text must be at least 50 characters').max(50000, 'Text must be at most 50000 characters'),
})

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rateLimited = await checkRateLimit(request, 'verify-text')
  if (rateLimited) return rateLimited

  // 2. Auth + quota check
  const authResult = await verifyAuth(request)
  if (isAuthError(authResult)) {
    const headers = authResult.quotaStatus ? quotaHeaders(authResult.quotaStatus) : {}
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status, headers }
    )
  }

  // 3. Validate
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // 4. Detect
  try {
    const result = await detectAIContent(parsed.data.text)
    const scoreRow = buildAiScoreRowFromComposite(result)

    // 5. Record usage
    recordApiUsage(authResult.userId, authResult.apiKeyId, 'verify-text').catch(() => {})

    // 6. Format per tier with quota headers
    const headers = quotaHeaders(authResult.quotaStatus)
    const payload = hasBreakdownAccess(authResult.tier)
      ? formatPaidResponse(scoreRow)
      : formatFreeResponse(scoreRow)

    return NextResponse.json(payload, { headers })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Detection failed. Please try again.' },
      { status: 500 }
    )
  }
}
