/**
 * AI Detection Service
 *
 * Handles AI detection for content and database persistence.
 * Supports text-only and multi-modal content analysis.
 *
 * Phase 7: Persists full explainability data (providerDetails,
 * heuristicMetrics, fusionDetails) and writes MediaScore records.
 */

import prisma from '@/lib/db/prisma'
import {
  detectAIContent,
  detectMultiModalContent,
  type CompositeResult,
  type DetectionOptions,
  type MultiModalResult,
  type ImageInput,
  type StoredProviderDetail,
  type StoredHeuristicMetrics,
  type StoredFusionDetails,
} from '@/lib/ai-detection'
// Prisma expects plain JSON values for JSONB columns; this type satisfies the constraint
type JsonSafe = ReturnType<typeof JSON.parse>

/**
 * Safely serialize objects for Prisma JSON columns.
 * Returns a plain JSON value that Prisma accepts for JSONB fields.
 */
function toJsonValue(value: unknown): JsonSafe {
  return JSON.parse(JSON.stringify(value))
}

// ---------------------------------------------------------------------------
// Result interfaces
// ---------------------------------------------------------------------------

export interface AnalyzeContentResult {
  contentId: string
  aiScore: {
    id: string
    compositeScore: number
    classification: string
    gptzeroScore: number | null
    heuristicScore: number | null
  }
  providerDetails?: StoredProviderDetail[]
  heuristicMetrics?: StoredHeuristicMetrics
  fusionDetails?: StoredFusionDetails
}

export interface MultiModalAnalyzeResult {
  contentId: string
  aiScore: {
    id: string
    compositeScore: number
    classification: string
    textScore: number | null
    textConfidence: number | null
    imageScore: number | null
    imageConfidence: number | null
    videoScore: number | null
    videoConfidence: number | null
    analyzedTypes: string[]
  }
  providerDetails?: StoredProviderDetail[]
  heuristicMetrics?: StoredHeuristicMetrics
  fusionDetails?: StoredFusionDetails
}

/**
 * Service-level multi-modal input
 * Uses videoUrl string instead of VideoInput object for convenience
 */
export interface ServiceMultiModalInput {
  text?: string
  images?: ImageInput[]
  videoUrl?: string
}

// ---------------------------------------------------------------------------
// Explainability data builders
// ---------------------------------------------------------------------------

/**
 * Build StoredProviderDetail[] from a text-only CompositeResult.
 */
function buildTextProviderDetails(result: CompositeResult): StoredProviderDetail[] {
  if (!result.metadata?.providerResults) return []

  return (result.metadata.providerResults as Record<string, unknown>[]).map((pr) => ({
    name: pr.name as string,
    type: pr.type as string,
    score: pr.score as number,
    confidence: pr.confidence as number,
    isPrimary: pr.isPrimary as boolean,
    available: pr.available as boolean,
    metadata: pr.metadata as StoredProviderDetail['metadata'],
  }))
}

/**
 * Build StoredHeuristicMetrics from a CompositeResult's metadata.
 */
function buildHeuristicMetrics(result: CompositeResult): StoredHeuristicMetrics | undefined {
  const meta = result.metadata
  if (!meta?.heuristicMetrics) return undefined

  return {
    ...meta.heuristicMetrics,
    featureScores: meta.heuristicFeatureScores ?? {
      vocabularyScore: 0,
      variationScore: 0,
      punctuationScore: 0,
      lengthScore: 0,
    },
    featureWeights: meta.heuristicFeatureWeights ?? {
      vocabulary: 0.35,
      variation: 0.30,
      punctuation: 0.15,
      length: 0.20,
    },
  }
}

/**
 * Build StoredFusionDetails for a text-only analysis.
 */
function buildTextFusionDetails(result: CompositeResult): StoredFusionDetails {
  const meta = result.metadata
  const primaryProvider = (meta?.primaryProvider as string) ?? 'heuristic'

  return {
    method: 'text_only',
    textFusion: {
      primaryProvider,
      apiWeight: meta?.apiWeight ?? 0,
      heuristicWeight: meta?.heuristicWeight ?? 1,
      apiScore: result.gptzeroScore ?? 0,
      heuristicScore: result.heuristicScore,
    },
  }
}

/**
 * Build StoredProviderDetail[] from a MultiModalResult.
 * Merges text provider details (from the text ContentTypeScore's metadata)
 * with image and video provider entries.
 */
function buildMultiModalProviderDetails(result: MultiModalResult): StoredProviderDetail[] {
  const details: StoredProviderDetail[] = []

  for (const cs of result.contentScores) {
    if (cs.type === 'text') {
      // The text ContentTypeScore's metadata contains providerResults from detectAIContent
      const textMeta = cs.metadata as Record<string, unknown> | undefined
      const providerResults = textMeta?.providerResults as Record<string, unknown>[] | undefined

      if (providerResults) {
        for (const pr of providerResults) {
          details.push({
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
    } else if (cs.type === 'image') {
      details.push({
        name: 'cnn_detection',
        type: 'image',
        score: cs.score,
        confidence: cs.confidence,
        isPrimary: true,
        available: true,
        metadata: {
          imageUrl: (cs.metadata as Record<string, unknown>)?.imageUrl as string | undefined,
        },
      })
    } else if (cs.type === 'video') {
      details.push({
        name: 'video_frame_analysis',
        type: 'video',
        score: cs.score,
        confidence: cs.confidence,
        isPrimary: true,
        available: true,
      })
    }
  }

  return details
}

/**
 * Build StoredHeuristicMetrics from a MultiModalResult.
 * Extracts from the text ContentTypeScore's metadata.
 */
function buildMultiModalHeuristicMetrics(result: MultiModalResult): StoredHeuristicMetrics | undefined {
  const textScore = result.contentScores.find((cs) => cs.type === 'text')
  if (!textScore?.metadata) return undefined

  const meta = textScore.metadata as Record<string, unknown>
  const heuristicMetrics = meta.heuristicMetrics as Record<string, unknown> | undefined
  if (!heuristicMetrics) return undefined

  const featureScores = meta.heuristicFeatureScores as Record<string, number> | undefined
  const featureWeights = meta.heuristicFeatureWeights as Record<string, number> | undefined

  return {
    vocabularyDiversity: (heuristicMetrics.vocabularyDiversity as number) ?? 0,
    sentenceLengthVariation: (heuristicMetrics.sentenceLengthVariation as number) ?? 0,
    avgSentenceLength: (heuristicMetrics.avgSentenceLength as number) ?? 0,
    punctuationVariety: (heuristicMetrics.punctuationVariety as number) ?? 0,
    paragraphCount: (heuristicMetrics.paragraphCount as number) ?? 1,
    wordCount: (heuristicMetrics.wordCount as number) ?? 0,
    featureScores: {
      vocabularyScore: featureScores?.vocabularyScore ?? 0,
      variationScore: featureScores?.variationScore ?? 0,
      punctuationScore: featureScores?.punctuationScore ?? 0,
      lengthScore: featureScores?.lengthScore ?? 0,
    },
    featureWeights: {
      vocabulary: featureWeights?.vocabulary ?? 0.35,
      variation: featureWeights?.variation ?? 0.30,
      punctuation: featureWeights?.punctuation ?? 0.15,
      length: featureWeights?.length ?? 0.20,
    },
  }
}

/**
 * Build StoredFusionDetails for a multi-modal analysis.
 */
function buildMultiModalFusionDetails(result: MultiModalResult): StoredFusionDetails {
  return {
    method: 'multi_modal',
    modalityWeights: result.metadata?.modalityWeights,
    totalEffectiveWeight: result.metadata?.totalEffectiveWeight,
  }
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Analyzes content text and stores the AI score in the database.
 * Updates the content status to 'analyzed' on success.
 */
export async function analyzeAndStoreScore(
  contentId: string,
  contentText: string,
  options?: DetectionOptions
): Promise<AnalyzeContentResult> {
  // Run AI detection
  const result = await detectAIContent(contentText, options)

  // Build explainability data
  const providerDetails = buildTextProviderDetails(result)
  const heuristicMetrics = buildHeuristicMetrics(result)
  const fusionDetails = buildTextFusionDetails(result)

  // Store the score in the database (with explainability JSONB columns)
  const aiScore = await prisma.aiScore.create({
    data: {
      contentId,
      compositeScore: result.compositeScore,
      classification: result.classification,
      gptzeroScore: result.gptzeroScore,
      heuristicScore: result.heuristicScore,
      // Phase 7: Explainability data
      providerDetails: providerDetails.length > 0
        ? toJsonValue(providerDetails)
        : undefined,
      heuristicMetrics: heuristicMetrics
        ? toJsonValue(heuristicMetrics)
        : undefined,
      fusionDetails: fusionDetails
        ? toJsonValue(fusionDetails)
        : undefined,
    },
  })

  // Update content status to analyzed
  await prisma.content.update({
    where: { id: contentId },
    data: { status: 'analyzed' },
  })

  return {
    contentId,
    aiScore: {
      id: aiScore.id,
      compositeScore: aiScore.compositeScore,
      classification: aiScore.classification,
      gptzeroScore: aiScore.gptzeroScore,
      heuristicScore: aiScore.heuristicScore,
    },
    providerDetails,
    heuristicMetrics,
    fusionDetails,
  }
}

/**
 * Gets the AI score for a piece of content, if it exists.
 */
export async function getAIScore(contentId: string) {
  return prisma.aiScore.findUnique({
    where: { contentId },
  })
}

/**
 * Re-analyzes content that has already been analyzed.
 * Deletes the existing score and creates a new one.
 */
export async function reanalyzeContent(
  contentId: string,
  contentText: string,
  options?: DetectionOptions
): Promise<AnalyzeContentResult> {
  // Delete existing score if present
  await prisma.aiScore.deleteMany({
    where: { contentId },
  })

  // Run new analysis
  return analyzeAndStoreScore(contentId, contentText, options)
}

/**
 * Analyzes content without storing the result.
 * Useful for preview/testing.
 */
export async function analyzeContentPreview(
  contentText: string,
  options?: DetectionOptions
): Promise<CompositeResult> {
  return detectAIContent(contentText, options)
}

/**
 * Analyzes multi-modal content and stores the AI score in the database.
 * Updates the content status to 'analyzed' on success.
 * Phase 7: Also persists explainability data and writes MediaScore records.
 */
export async function analyzeMultiModalAndStore(
  contentId: string,
  input: ServiceMultiModalInput,
  options?: DetectionOptions
): Promise<MultiModalAnalyzeResult> {
  // Run multi-modal AI detection
  const result = await detectMultiModalContent(
    {
      text: input.text,
      images: input.images,
      video: input.videoUrl ? { url: input.videoUrl } : undefined,
    },
    options
  )

  // Build explainability data
  const providerDetails = buildMultiModalProviderDetails(result)
  const heuristicMetrics = buildMultiModalHeuristicMetrics(result)
  const fusionDetails = buildMultiModalFusionDetails(result)

  // Store the score in the database
  const aiScore = await prisma.aiScore.create({
    data: {
      contentId,
      compositeScore: result.compositeScore,
      classification: result.classification,
      // Legacy fields (null for multi-modal)
      gptzeroScore: null,
      heuristicScore: null,
      // Multi-modal fields
      textScore: result.metadata?.textScore ?? null,
      textConfidence: result.metadata?.textConfidence ?? null,
      imageScore: result.metadata?.imageScore ?? null,
      imageConfidence: result.metadata?.imageConfidence ?? null,
      videoScore: result.metadata?.videoScore ?? null,
      videoConfidence: result.metadata?.videoConfidence ?? null,
      analyzedTypes: result.analyzedTypes,
      // Phase 7: Explainability data
      providerDetails: providerDetails.length > 0
        ? toJsonValue(providerDetails)
        : undefined,
      heuristicMetrics: heuristicMetrics
        ? toJsonValue(heuristicMetrics)
        : undefined,
      fusionDetails: fusionDetails
        ? toJsonValue(fusionDetails)
        : undefined,
    },
  })

  // Store media and MediaScore records for images
  if (input.images && input.images.length > 0) {
    // Create ContentMedia records for each image
    await prisma.contentMedia.createMany({
      data: input.images.map((img) => ({
        contentId,
        type: 'image',
        url: img.url || null,
      })),
    })

    // Query back created media IDs to link MediaScore records
    const createdMedia = await prisma.contentMedia.findMany({
      where: { contentId, type: 'image' },
      orderBy: { createdAt: 'asc' },
    })

    // Extract per-image scores from the image ContentTypeScore metadata
    const imageContentScore = result.contentScores.find((cs) => cs.type === 'image')
    const perImageScores = (imageContentScore?.metadata as Record<string, unknown>)
      ?.perImageScores as Array<{ index: number; score: number; confidence: number; url?: string }> | undefined

    if (perImageScores && createdMedia.length > 0) {
      const mediaScoreData = createdMedia.map((media, idx) => {
        const imgScore = perImageScores[idx]
        return {
          mediaId: media.id,
          score: imgScore?.score ?? 0.5,
          confidence: imgScore?.confidence ?? 0.5,
          providerName: 'cnn_detection',
        }
      })

      await prisma.mediaScore.createMany({ data: mediaScoreData })
    }
  }

  // Store media and MediaScore record for video
  if (input.videoUrl) {
    const videoMedia = await prisma.contentMedia.create({
      data: {
        contentId,
        type: 'video',
        url: input.videoUrl,
      },
    })

    // Extract video score and per-frame data from the video ContentTypeScore
    const videoContentScore = result.contentScores.find((cs) => cs.type === 'video')
    if (videoContentScore) {
      const videoMeta = videoContentScore.metadata as Record<string, unknown> | undefined
      const perFrameScores = videoMeta?.perFrameScores as Array<{
        index: number; timestamp: number; score: number; confidence: number
      }> | undefined

      await prisma.mediaScore.create({
        data: {
          mediaId: videoMedia.id,
          score: videoContentScore.score,
          confidence: videoContentScore.confidence,
          providerName: 'video_frame_analysis',
          frameScores: perFrameScores
            ? toJsonValue(perFrameScores)
            : undefined,
        },
      })
    }
  }

  // Update content status to analyzed
  await prisma.content.update({
    where: { id: contentId },
    data: { status: 'analyzed' },
  })

  return {
    contentId,
    aiScore: {
      id: aiScore.id,
      compositeScore: aiScore.compositeScore,
      classification: aiScore.classification,
      textScore: aiScore.textScore,
      textConfidence: aiScore.textConfidence,
      imageScore: aiScore.imageScore,
      imageConfidence: aiScore.imageConfidence,
      videoScore: aiScore.videoScore,
      videoConfidence: aiScore.videoConfidence,
      analyzedTypes: aiScore.analyzedTypes,
    },
    providerDetails,
    heuristicMetrics,
    fusionDetails,
  }
}

/**
 * Analyzes multi-modal content without storing the result.
 * Useful for preview/testing.
 */
export async function analyzeMultiModalPreview(
  input: ServiceMultiModalInput,
  options?: DetectionOptions
): Promise<MultiModalResult> {
  return detectMultiModalContent(
    {
      text: input.text,
      images: input.images,
      video: input.videoUrl ? { url: input.videoUrl } : undefined,
    },
    options
  )
}

// TODO: Phase 4 API endpoints (src/app/api/v1/verify/*) do not exist yet.
// When they are created, the updated service functions above will automatically
// persist explainability data. The API route handlers should use formatFreeResponse
// or formatPaidResponse from format-breakdown.ts based on caller tier.
