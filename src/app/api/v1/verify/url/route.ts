/**
 * POST /api/v1/verify/url
 *
 * Extract content from a URL and verify it for AI detection.
 * Optionally extracts media for multi-modal analysis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { verifyAuth, isAuthError, quotaHeaders } from '@/lib/api/verify-auth'
import { detectAIContent, detectMultiModalContent } from '@/lib/ai-detection'
import { hasBreakdownAccess } from '@/lib/api/check-tier'
import { formatFreeResponse, formatPaidResponse } from '@/lib/ai-detection/format-breakdown'
import { extractContent, ExtractionError } from '@/lib/services/extraction.service'
import { extractMediaFromUrl } from '@/lib/services/media-extraction.service'
import { buildAiScoreRowFromComposite, buildAiScoreRowFromMultiModal } from '../_lib/build-score-row'
import { recordApiUsage } from '@/lib/services/quota.service'
import { isDomainBlocked } from '@/lib/security/domain-blocklist'

const requestSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  extractMedia: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rateLimited = await checkRateLimit(request, 'verify-url')
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

  // 3.5. Domain blocklist check
  const blockCheck = await isDomainBlocked(parsed.data.url)
  if (blockCheck.blocked) {
    return NextResponse.json(
      { error: 'This URL cannot be verified' },
      { status: 403 }
    )
  }

  // 4. Extract content
  let extracted
  try {
    extracted = await extractContent(parsed.data.url)
  } catch (error) {
    if (error instanceof ExtractionError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json(
      { error: 'Failed to extract content from URL' },
      { status: 422 }
    )
  }

  // 5. Detect
  try {
    let scoreRow

    if (parsed.data.extractMedia) {
      const media = await extractMediaFromUrl(parsed.data.url)
      const result = await detectMultiModalContent({
        text: extracted.contentText,
        images: media.images,
        video: media.video ?? undefined,
      })
      scoreRow = buildAiScoreRowFromMultiModal(result)
    } else {
      const result = await detectAIContent(extracted.contentText)
      scoreRow = buildAiScoreRowFromComposite(result)
    }

    // 6. Record usage
    recordApiUsage(authResult.userId, authResult.apiKeyId, 'verify-url').catch(() => {})

    // 7. Format per tier with quota headers
    const headers = quotaHeaders(authResult.quotaStatus)
    const response = hasBreakdownAccess(authResult.tier)
      ? formatPaidResponse(scoreRow)
      : formatFreeResponse(scoreRow)

    return NextResponse.json({
      ...response,
      meta: {
        url: extracted.url,
        domain: extracted.domain,
        title: extracted.title,
      },
    }, { headers })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: 'Detection failed. Please try again.' },
      { status: 500 }
    )
  }
}
