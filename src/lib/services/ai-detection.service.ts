/**
 * AI Detection Service
 *
 * Handles AI detection for content and database persistence.
 * Supports text-only and multi-modal content analysis.
 */

import prisma from '@/lib/db/prisma'
import {
  detectAIContent,
  detectMultiModalContent,
  type CompositeResult,
  type DetectionOptions,
  type MultiModalInput as CoreMultiModalInput,
  type MultiModalResult,
  type ImageInput,
} from '@/lib/ai-detection'

export interface AnalyzeContentResult {
  contentId: string
  aiScore: {
    id: string
    compositeScore: number
    classification: string
    gptzeroScore: number | null
    heuristicScore: number | null
  }
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

  // Store the score in the database
  const aiScore = await prisma.aiScore.create({
    data: {
      contentId,
      compositeScore: result.compositeScore,
      classification: result.classification,
      gptzeroScore: result.gptzeroScore,
      heuristicScore: result.heuristicScore,
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
    },
  })

  // Store media if images or video were provided
  if (input.images && input.images.length > 0) {
    await prisma.contentMedia.createMany({
      data: input.images.map((img) => ({
        contentId,
        type: 'image',
        url: img.url || null,
      })),
    })
  }

  if (input.videoUrl) {
    await prisma.contentMedia.create({
      data: {
        contentId,
        type: 'video',
        url: input.videoUrl,
      },
    })
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
