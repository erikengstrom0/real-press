/**
 * POST /api/v1/verify/batch
 *
 * Batch verification of multiple items (text, url, or image).
 * Max items per tier: free=10, pro=25, enterprise=50.
 * Processes sequentially with per-item error handling.
 * Each item in the batch counts as one request toward the monthly quota.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { verifyAuth, isAuthError, quotaHeaders, type VerifyAuthResult } from '@/lib/api/verify-auth'
import { detectAIContent, detectMultiModalContent } from '@/lib/ai-detection'
import { hasBreakdownAccess, type UserTier } from '@/lib/api/check-tier'
import { formatFreeResponse, formatPaidResponse } from '@/lib/ai-detection/format-breakdown'
import { extractContent } from '@/lib/services/extraction.service'
import { buildAiScoreRowFromComposite, buildAiScoreRowFromMultiModal } from '../_lib/build-score-row'
import { recordApiUsage } from '@/lib/services/quota.service'
import { isDomainBlocked } from '@/lib/security/domain-blocklist'

const batchItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string().min(50).max(50000),
  }),
  z.object({
    type: z.literal('url'),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal('image'),
    imageUrl: z.string().url().optional(),
    imageBase64: z.string().min(1).optional(),
  }).refine(
    (data) => data.imageUrl || data.imageBase64,
    { message: 'Either imageUrl or imageBase64 is required' }
  ),
])

const requestSchema = z.object({
  items: z.array(batchItemSchema).min(1),
})

const TIER_MAX_ITEMS: Record<UserTier, number> = {
  free: 10,
  pro: 25,
  enterprise: 50,
}

type BatchItem = z.infer<typeof batchItemSchema>

async function processItem(
  item: BatchItem,
  authResult: VerifyAuthResult,
): Promise<{ result: unknown } | { error: string }> {
  try {
    if (item.type === 'text') {
      const result = await detectAIContent(item.text)
      const scoreRow = buildAiScoreRowFromComposite(result)
      const formatted = hasBreakdownAccess(authResult.tier)
        ? formatPaidResponse(scoreRow)
        : formatFreeResponse(scoreRow)
      return { result: formatted }
    }

    if (item.type === 'url') {
      // Parse URL to get hostname
      let hostname: string
      try {
        hostname = new URL(item.url).hostname
      } catch {
        return { error: 'Invalid URL format' }
      }

      // Check if domain is blocked
      const blockCheck = await isDomainBlocked(hostname)
      if (blockCheck.blocked) {
        return { error: blockCheck.reason || 'This URL cannot be verified' }
      }

      // Continue with extraction and detection
      const extracted = await extractContent(item.url)
      const result = await detectAIContent(extracted.contentText)
      const scoreRow = buildAiScoreRowFromComposite(result)
      const formatted = hasBreakdownAccess(authResult.tier)
        ? formatPaidResponse(scoreRow)
        : formatFreeResponse(scoreRow)
      return {
        result: {
          ...formatted,
          meta: {
            url: extracted.url,
            domain: extracted.domain,
            title: extracted.title,
          },
        },
      }
    }

    if (item.type === 'image') {
      const result = await detectMultiModalContent({
        images: [{
          url: item.imageUrl,
          base64: item.imageBase64,
        }],
      })
      const scoreRow = buildAiScoreRowFromMultiModal(result)
      const formatted = hasBreakdownAccess(authResult.tier)
        ? formatPaidResponse(scoreRow)
        : formatFreeResponse(scoreRow)
      return { result: formatted }
    }

    return { error: 'Unknown item type' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Detection failed'
    return { error: message }
  }
}

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rateLimited = await checkRateLimit(request, 'verify-batch')
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

  // 4. Check tier-based max items
  const maxItems = TIER_MAX_ITEMS[authResult.tier]
  if (parsed.data.items.length > maxItems) {
    return NextResponse.json(
      { error: `Too many items. Your tier (${authResult.tier}) allows up to ${maxItems} items per batch.` },
      { status: 400 }
    )
  }

  // 5. Check quota covers the full batch
  const itemCount = parsed.data.items.length
  if (authResult.quotaStatus.remaining < itemCount) {
    return NextResponse.json(
      {
        error: `Insufficient quota. This batch has ${itemCount} items but you only have ${authResult.quotaStatus.remaining} requests remaining this month.`,
      },
      { status: 429, headers: quotaHeaders(authResult.quotaStatus) }
    )
  }

  // 6. Process sequentially
  const results = []
  for (const item of parsed.data.items) {
    const itemResult = await processItem(item, authResult)
    results.push(itemResult)
  }

  // 7. Record usage (count = number of items)
  recordApiUsage(authResult.userId, authResult.apiKeyId, 'verify-batch', itemCount).catch(() => {})

  // 8. Return with quota headers
  const headers = quotaHeaders(authResult.quotaStatus)
  return NextResponse.json({ results }, { headers })
}
