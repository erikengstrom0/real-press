/**
 * GET /api/content/[id]/breakdown
 *
 * Returns the explainability breakdown for a piece of content.
 * Response is tier-gated:
 * - Free users: score, classification, confidence, analyzedTypes
 * - Pro/Enterprise users: full breakdown with provider details, heuristic signals, fusion weights
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getUserTier, hasBreakdownAccess } from '@/lib/api/check-tier'
import {
  formatFreeResponse,
  formatPaidResponse,
  type AiScoreRow,
  type MediaScoreRow,
} from '@/lib/ai-detection/format-breakdown'
import type {
  StoredProviderDetail,
  StoredHeuristicMetrics,
  StoredFusionDetails,
  Classification,
  ContentType,
} from '@/lib/ai-detection/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Fetch AiScore for this content
  const aiScore = await prisma.aiScore.findUnique({
    where: { contentId: id },
  })

  if (!aiScore) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  // Check if explainability data is available
  const hasExplainability = aiScore.providerDetails !== null

  if (!hasExplainability) {
    return NextResponse.json({
      hasExplainability: false,
      score: aiScore.compositeScore,
      classification: aiScore.classification,
      message: 'This content was analyzed before detailed tracking was available.',
    })
  }

  // Determine user tier
  // In the future, this will come from the session or API key.
  // For now, check-tier.ts is a stub that returns 'free'.
  // We accept an X-User-Tier header for development/testing purposes.
  const devTierOverride = request.headers.get('x-user-tier')
  const tier = (devTierOverride === 'pro' || devTierOverride === 'enterprise')
    ? devTierOverride
    : getUserTier('anonymous')

  // Build the AiScoreRow for the formatter
  const scoreRow: AiScoreRow = {
    compositeScore: aiScore.compositeScore,
    classification: aiScore.classification as Classification,
    providerDetails: aiScore.providerDetails as StoredProviderDetail[] | null,
    heuristicMetrics: aiScore.heuristicMetrics as StoredHeuristicMetrics | null,
    fusionDetails: aiScore.fusionDetails as StoredFusionDetails | null,
    textScore: aiScore.textScore,
    textConfidence: aiScore.textConfidence,
    imageScore: aiScore.imageScore,
    imageConfidence: aiScore.imageConfidence,
    videoScore: aiScore.videoScore,
    videoConfidence: aiScore.videoConfidence,
    analyzedTypes: (aiScore.analyzedTypes ?? ['text']) as ContentType[],
  }

  if (!hasBreakdownAccess(tier)) {
    // Free tier — return basic response with a header indicating breakdown is available
    const response = NextResponse.json({
      hasExplainability: true,
      ...formatFreeResponse(scoreRow),
    })
    response.headers.set('X-Breakdown-Available', 'true')
    return response
  }

  // Pro/Enterprise tier — fetch MediaScores and return full breakdown
  const mediaRecords = await prisma.contentMedia.findMany({
    where: { contentId: id },
    include: { mediaScore: true },
  })

  const mediaScores: MediaScoreRow[] = mediaRecords
    .filter((m) => m.mediaScore !== null)
    .map((m) => ({
      id: m.mediaScore!.id,
      mediaType: m.type,
      score: m.mediaScore!.score,
      confidence: m.mediaScore!.confidence,
      providerName: m.mediaScore!.providerName,
      url: m.url,
      frameScores: m.mediaScore!.frameScores as MediaScoreRow['frameScores'],
    }))

  return NextResponse.json({
    hasExplainability: true,
    ...formatPaidResponse(scoreRow, mediaScores),
  })
}
