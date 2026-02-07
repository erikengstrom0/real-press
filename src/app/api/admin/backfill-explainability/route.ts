/**
 * POST /api/admin/backfill-explainability
 *
 * Re-runs detection on content that was analyzed before Phase 7,
 * populating the providerDetails, heuristicMetrics, and fusionDetails
 * JSONB columns without changing the original compositeScore or classification.
 *
 * Protected by ADMIN_SECRET (middleware handles auth for /api/admin/* routes).
 *
 * Body: { batchSize?: number } (default 10, max 50)
 *
 * Returns: { processed: number, remaining: number, errors: string[] }
 *
 * Idempotent: skips rows that already have providerDetails.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { detectAIContent } from '@/lib/ai-detection'
import type {
  StoredProviderDetail,
  StoredHeuristicMetrics,
  StoredFusionDetails,
} from '@/lib/ai-detection/types'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  // Parse body
  let batchSize = 10
  try {
    const body = await request.json()
    if (body.batchSize && typeof body.batchSize === 'number') {
      batchSize = Math.min(Math.max(body.batchSize, 1), 50)
    }
  } catch {
    // No body or invalid JSON — use defaults
  }

  // Use raw SQL to find AiScores where provider_details IS NULL
  // This avoids Prisma's JsonNullValueFilter typing issues
  const toBackfillRaw = await prisma.$queryRawUnsafe<
    Array<{ id: string; content_id: string }>
  >(
    `SELECT id, content_id FROM ai_scores WHERE provider_details IS NULL ORDER BY created_at DESC LIMIT $1`,
    batchSize
  )

  // Count remaining
  const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM ai_scores WHERE provider_details IS NULL`
  )
  const totalMissing = Number(countResult[0]?.count ?? 0)
  const remaining = Math.max(0, totalMissing - toBackfillRaw.length)

  const errors: string[] = []
  let processed = 0
  const startTime = Date.now()
  const TIME_LIMIT_MS = 50_000 // Exit at 50s to leave margin before 60s timeout

  for (const row of toBackfillRaw) {
    // Exit early if approaching the Vercel function timeout
    if (Date.now() - startTime > TIME_LIMIT_MS) {
      break
    }

    try {
      // Fetch the content text for re-analysis
      const content = await prisma.content.findUnique({
        where: { id: row.content_id },
        select: { contentText: true },
      })

      if (!content?.contentText || content.contentText.trim().length === 0) {
        errors.push(`${row.id}: No content text available`)
        continue
      }

      // Re-run detection to get enriched metadata
      const result = await detectAIContent(content.contentText)

      // Build explainability data from the new result
      const providerDetails: StoredProviderDetail[] = []
      const providerResults = result.metadata?.providerResults as Record<string, unknown>[] | undefined

      if (providerResults) {
        for (const pr of providerResults) {
          providerDetails.push({
            name: pr.name as string,
            type: pr.type as string,
            score: pr.score as number,
            confidence: pr.confidence as number,
            isPrimary: pr.isPrimary as boolean,
            available: pr.available as boolean,
            metadata: pr.metadata as StoredProviderDetail['metadata'],
          })
        }
      }

      const heuristicMetrics: StoredHeuristicMetrics | undefined =
        result.metadata?.heuristicMetrics
          ? {
              ...result.metadata.heuristicMetrics,
              featureScores: result.metadata.heuristicFeatureScores ?? {
                vocabularyScore: 0,
                variationScore: 0,
                punctuationScore: 0,
                lengthScore: 0,
              },
              featureWeights: result.metadata.heuristicFeatureWeights ?? {
                vocabulary: 0.35,
                variation: 0.30,
                punctuation: 0.15,
                length: 0.20,
              },
            }
          : undefined

      const primaryProvider = (result.metadata?.primaryProvider as string) ?? 'heuristic'
      const fusionDetails: StoredFusionDetails = {
        method: 'text_only',
        textFusion: {
          primaryProvider,
          apiWeight: result.metadata?.apiWeight ?? 0,
          heuristicWeight: result.metadata?.heuristicWeight ?? 1,
          apiScore: result.gptzeroScore ?? 0,
          heuristicScore: result.heuristicScore,
        },
      }

      // Update ONLY the JSONB columns — do NOT change compositeScore or classification
      // Using raw SQL to avoid Prisma JSON typing complexities
      await prisma.$queryRawUnsafe(
        `UPDATE ai_scores SET provider_details = $1::jsonb, heuristic_metrics = $2::jsonb, fusion_details = $3::jsonb WHERE id = $4`,
        JSON.stringify(providerDetails.length > 0 ? providerDetails : null),
        JSON.stringify(heuristicMetrics ?? null),
        JSON.stringify(fusionDetails),
        row.id
      )

      processed++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${row.id}: ${message}`)
    }
  }

  const timedOut = Date.now() - startTime > TIME_LIMIT_MS
  // Adjust remaining to account for items we fetched but didn't process due to time limit
  const actualRemaining = remaining + (toBackfillRaw.length - processed - errors.length)

  return NextResponse.json({
    processed,
    remaining: actualRemaining,
    errors,
    timedOut,
    timestamp: new Date().toISOString(),
  })
}
