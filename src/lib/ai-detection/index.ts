/**
 * AI Detection Module
 *
 * Orchestrates AI detection using multiple providers:
 * 1. Hugging Face (primary, free, always available)
 * 2. GPTZero API (secondary, when configured)
 * 3. Heuristic analysis (fallback, always available)
 * 4. Image detection via ML service
 * 5. Video detection via frame analysis
 *
 * Results are combined into a composite score with classification.
 */

import { analyzeWithGPTZero, isGPTZeroConfigured } from './providers/gptzero.provider'
import { analyzeWithHuggingFace, isHuggingFaceAvailable } from './providers/huggingface.provider'
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
  HeuristicFeatureScores,
  HeuristicFeatureWeights,
  StoredHeuristicMetrics,
  StoredProviderDetail,
  StoredFusionDetails,
  ModalityWeight,
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
export { isHuggingFaceAvailable }

export interface DetectionOptions {
  skipGPTZero?: boolean
  skipHuggingFace?: boolean
  skipImages?: boolean
  skipVideo?: boolean
}

/**
 * Legacy text-only detection function
 * Maintains backwards compatibility with existing code
 *
 * Provider priority:
 * 1. Hugging Face (free, always available)
 * 2. GPTZero (paid, when configured)
 * 3. Heuristics (always runs as baseline)
 */
export async function detectAIContent(
  text: string,
  options: DetectionOptions = {}
): Promise<CompositeResult> {
  // Always run heuristic analysis
  const heuristicResult = await analyzeWithHeuristics(text)

  // Try Hugging Face first (free, always available)
  let huggingfaceResult = null
  if (!options.skipHuggingFace && isHuggingFaceAvailable()) {
    huggingfaceResult = await analyzeWithHuggingFace(text)
  }

  // Run GPTZero if configured and not skipped (as secondary/validation)
  let gptzeroResult = null
  if (!options.skipGPTZero && isGPTZeroConfigured()) {
    gptzeroResult = await analyzeWithGPTZero(text)
  }

  // Use Hugging Face as primary, fall back to GPTZero
  const primaryApiResult = huggingfaceResult || gptzeroResult
  const primaryProviderName = huggingfaceResult ? 'huggingface' : (gptzeroResult ? 'gptzero' : null)

  // Calculate composite score
  const result = calculateCompositeScore({
    gptzeroScore: primaryApiResult?.score ?? null,
    gptzeroConfidence: primaryApiResult?.confidence ?? null,
    heuristicScore: heuristicResult.score,
    heuristicConfidence: heuristicResult.confidence,
    heuristicMetrics: heuristicResult.metrics,
  })

  // Enrich metadata with provider info and heuristic breakdown
  if (result.metadata) {
    result.metadata.primaryProvider = primaryProviderName
    result.metadata.huggingfaceAvailable = huggingfaceResult !== null
    result.metadata.gptzeroAvailable = gptzeroResult !== null
    result.metadata.heuristicFeatureScores = heuristicResult.featureScores
    result.metadata.heuristicFeatureWeights = heuristicResult.featureWeights

    // Collect individual provider results for downstream consumers
    const providerResults: Record<string, unknown>[] = []

    providerResults.push({
      name: 'heuristic',
      type: 'text',
      score: heuristicResult.score,
      confidence: heuristicResult.confidence,
      available: true,
      isPrimary: primaryProviderName === null,
      metadata: {
        metrics: heuristicResult.metrics,
        featureScores: heuristicResult.featureScores,
        featureWeights: heuristicResult.featureWeights,
      },
    })

    if (huggingfaceResult) {
      providerResults.push({
        name: 'huggingface',
        type: 'text',
        score: huggingfaceResult.score,
        confidence: huggingfaceResult.confidence,
        available: true,
        isPrimary: primaryProviderName === 'huggingface',
        metadata: huggingfaceResult.metadata,
      })
    } else {
      providerResults.push({
        name: 'huggingface',
        type: 'text',
        score: 0,
        confidence: 0,
        available: false,
        isPrimary: false,
      })
    }

    if (gptzeroResult) {
      providerResults.push({
        name: 'gptzero',
        type: 'text',
        score: gptzeroResult.score,
        confidence: gptzeroResult.confidence,
        available: true,
        isPrimary: primaryProviderName === 'gptzero',
        metadata: gptzeroResult.metadata,
      })
    } else {
      providerResults.push({
        name: 'gptzero',
        type: 'text',
        score: 0,
        confidence: 0,
        available: false,
        isPrimary: false,
      })
    }

    result.metadata.providerResults = providerResults
  }

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

  // Determine provider name and confidence based on what was used
  const primaryProvider = result.metadata?.primaryProvider as string | null
  let providerName = 'heuristic'
  let confidence = 0.6

  if (primaryProvider === 'huggingface') {
    providerName = 'huggingface+heuristic'
    confidence = 0.8
  } else if (primaryProvider === 'gptzero') {
    providerName = 'gptzero+heuristic'
    confidence = 0.85
  }

  return {
    type: 'text',
    score: result.compositeScore,
    confidence,
    providerName,
    metadata: result.metadata,
  }
}

/**
 * Per-image score detail for explainability
 */
interface PerImageScore {
  index: number
  score: number
  confidence: number
  url?: string
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

  // Analyze each image and collect per-image details
  const imageScores: Array<{ score: number; confidence: number }> = []
  const perImageScores: PerImageScore[] = []

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
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
      perImageScores.push({
        index: i,
        score: result.score,
        confidence: result.confidence,
        url: image.url,
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
      perImageScores,
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
  // contentScores[] already includes all provider metadata from each analyzer
  return calculateMultiModalComposite(contentScores)
}
