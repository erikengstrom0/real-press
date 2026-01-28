/**
 * AI Detection Service
 *
 * Handles AI detection for content and database persistence.
 */

import prisma from '@/lib/db/prisma'
import { detectAIContent, type CompositeResult, type DetectionOptions } from '@/lib/ai-detection'

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
