/**
 * POST /api/v1/verify/image
 *
 * Verify an image for AI detection.
 * Accepts imageUrl or imageBase64 input.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { verifyAuth, isAuthError, quotaHeaders } from '@/lib/api/verify-auth'
import { detectMultiModalContent } from '@/lib/ai-detection'
import { hasBreakdownAccess } from '@/lib/api/check-tier'
import { formatFreeResponse, formatPaidResponse } from '@/lib/ai-detection/format-breakdown'
import { buildAiScoreRowFromMultiModal } from '../_lib/build-score-row'
import { recordApiUsage } from '@/lib/services/quota.service'

const requestSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().min(1).optional(),
}).refine(
  (data) => data.imageUrl || data.imageBase64,
  { message: 'Either imageUrl or imageBase64 is required' }
)

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rateLimited = await checkRateLimit(request, 'verify-image')
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
    const result = await detectMultiModalContent({
      images: [{
        url: parsed.data.imageUrl,
        base64: parsed.data.imageBase64,
      }],
    })

    const scoreRow = buildAiScoreRowFromMultiModal(result)

    // 5. Record usage
    recordApiUsage(authResult.userId, authResult.apiKeyId, 'verify-image').catch(() => {})

    // 6. Format per tier with quota headers
    const headers = quotaHeaders(authResult.quotaStatus)
    const payload = hasBreakdownAccess(authResult.tier)
      ? formatPaidResponse(scoreRow)
      : formatFreeResponse(scoreRow)

    return NextResponse.json(payload, { headers })
  } catch (error) {
    console.error('Image verification error:', error)
    return NextResponse.json(
      { error: 'Image detection failed. Please try again.' },
      { status: 500 }
    )
  }
}
