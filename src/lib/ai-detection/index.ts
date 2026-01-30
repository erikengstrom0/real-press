/**
 * AI Detection Module
 *
 * Orchestrates AI detection using multiple providers:
 * 1. GPTZero API (primary, when available)
 * 2. Heuristic analysis (fallback, always available)
 * 3. Image detection via ML service
 * 4. Video detection via frame analysis
 *
 * Results are combined into a composite score with classification.
 */

import { analyzeWithGPTZero, isGPTZeroConfigured } from './providers/gptzero.provider'
import { analyzeWithHeuristics } from './providers/heuristic.provider'
import { localImageProvider } from './providers/image-local.provider'
import { videoProvider } from './providers/video.provider'
import {
  calculateCompositeScore,
  calculateMultiModalComposite,
  aggregateImageScores,
} from './composite-score'
import type {
  CompositeResult,
  MultiModalInput,
  MultiModalResult,
  ContentTypeScore,
  ImageInput,
} from './types'

export type {
  Classification,
  CompositeResult,
  HeuristicMetrics,
  ContentType,
  MultiModalInput,
  MultiModalResult,
  ContentTypeScore,
  ImageInput,
  VideoInput,
} from './types'
export {
  classifyScore,
  getClassificationLabel,
  getClassificationColor,
  calculateMultiModalComposite,
  aggregateImageScores,
} from './composite-score'
export { isGPTZeroConfigured }

export interface DetectionOptions {
  skipGPTZero?: boolean
  skipImages?: boolean
  skipVideo?: boolean
}

/**
 * Legacy text-only detection function
 * Maintains backwards compatibility with existing code
 */
export async function detectAIContent(
  text: string,
  options: DetectionOptions = {}
): Promise<CompositeResult> {
  // Always run heuristic analysis
  const heuristicResult = await analyzeWithHeuristics(text)

  // Run GPTZero if configured and not skipped
  let gptzeroResult = null
  if (!options.skipGPTZero && isGPTZeroConfigured()) {
    gptzeroResult = await analyzeWithGPTZero(text)
  }

  // Calculate composite score
  const result = calculateCompositeScore({
    gptzeroScore: gptzeroResult?.score ?? null,
    gptzeroConfidence: gptzeroResult?.confidence ?? null,
    heuristicScore: heuristicResult.score,
    heuristicConfidence: heuristicResult.confidence,
    heuristicMetrics: heuristicResult.metrics,
  })

  return result
}

/**
 * Analyze text content and return a ContentTypeScore
 */
async function analyzeText(
  text: string,
  options: DetectionOptions = {}
): Promise<ContentTypeScore | null> {
  if (!text || text.trim().length === 0) {
    return null
  }

  const result = await detectAIContent(text, options)

  return {
    type: 'text',
    score: result.compositeScore,
    confidence: result.gptzeroScore !== null ? 0.85 : 0.6, // Higher confidence with GPTZero
    providerName: result.gptzeroScore !== null ? 'gptzero+heuristic' : 'heuristic',
    metadata: result.metadata,
  }
}

/**
 * Analyze images and return a ContentTypeScore
 */
async function analyzeImages(images: ImageInput[]): Promise<ContentTypeScore | null> {
  if (!images || images.length === 0) {
    return null
  }

  if (!localImageProvider.isAvailable()) {
    console.warn('Image detection is not available')
    return null
  }

  // Analyze each image
  const imageScores: Array<{ score: number; confidence: number }> = []

  for (const image of images) {
    const result = await localImageProvider.analyze({
      type: 'image',
      imageUrl: image.url,
      imageBase64: image.base64,
    })

    if (result) {
      imageScores.push({
        score: result.score,
        confidence: result.confidence,
      })
    }
  }

  if (imageScores.length === 0) {
    return null
  }

  // Aggregate image scores
  const aggregated = aggregateImageScores(imageScores)

  return {
    type: 'image',
    score: aggregated.score,
    confidence: aggregated.confidence,
    providerName: 'image-local',
    metadata: {
      imageCount: images.length,
      analyzedCount: imageScores.length,
    },
  }
}

/**
 * Analyze video by extracting and analyzing frames
 */
async function analyzeVideo(videoUrl: string): Promise<ContentTypeScore | null> {
  if (!videoProvider.isAvailable()) {
    console.warn('Video detection is not available')
    return null
  }

  const result = await videoProvider.analyze({
    type: 'video',
    videoUrl,
  })

  if (!result) {
    return null
  }

  return {
    type: 'video',
    score: result.score,
    confidence: result.confidence,
    providerName: 'video',
    metadata: result.metadata,
  }
}

/**
 * Multi-modal content detection
 *
 * Analyzes text, images, and/or video content and combines results
 * into a unified score using confidence-based weighting.
 *
 * @param input - Content to analyze (text, images, video)
 * @param options - Detection options
 * @returns Multi-modal detection result with composite score
 */
export async function detectMultiModalContent(
  input: MultiModalInput,
  options: DetectionOptions = {}
): Promise<MultiModalResult> {
  const contentScores: ContentTypeScore[] = []

  // Analyze text if provided
  if (input.text) {
    const textScore = await analyzeText(input.text, options)
    if (textScore) {
      contentScores.push(textScore)
    }
  }

  // Analyze images if provided and not skipped
  if (input.images && input.images.length > 0 && !options.skipImages) {
    const imageScore = await analyzeImages(input.images)
    if (imageScore) {
      contentScores.push(imageScore)
    }
  }

  // Analyze video if provided and not skipped
  if (input.video && !options.skipVideo) {
    const videoScore = await analyzeVideo(input.video.url)
    if (videoScore) {
      contentScores.push(videoScore)
    }
  }

  // Calculate multi-modal composite
  return calculateMultiModalComposite(contentScores)
}
