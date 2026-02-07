/**
 * POST /api/v1/verify/text
 *
 * Verify text content for AI detection.
 * Accepts 50-50000 characters of text, returns score formatted per tier.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { verifyAuth, isAuthError } from '@/lib/api/verify-auth'
import { detectAIContent } from '@/lib/ai-detection'
import { hasBreakdownAccess } from '@/lib/api/check-tier'
import { formatFreeResponse, formatPaidResponse } from '@/lib/ai-detection/format-breakdown'
import { buildAiScoreRowFromComposite } from '../_lib/build-score-row'

const requestSchema = z.object({
  text: z.string().min(50, 'Text must be at least 50 characters').max(50000, 'Text must be at most 50000 characters'),
})

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rateLimited = await checkRateLimit(request, 'verify-text')
  if (rateLimited) return rateLimited

  // 2. Auth
  const authResult = await verifyAuth(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
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

    // 5. Format per tier
    if (hasBreakdownAccess(authResult.tier)) {
      return NextResponse.json(formatPaidResponse(scoreRow))
    }

    return NextResponse.json(formatFreeResponse(scoreRow))
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Detection failed. Please try again.' },
      { status: 500 }
    )
  }
}
