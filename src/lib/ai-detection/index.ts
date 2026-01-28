/**
 * AI Detection Module
 *
 * Orchestrates AI detection using multiple providers:
 * 1. GPTZero API (primary, when available)
 * 2. Heuristic analysis (fallback, always available)
 *
 * Results are combined into a composite score with classification.
 */

import { analyzeWithGPTZero, isGPTZeroConfigured } from './providers/gptzero.provider'
import { analyzeWithHeuristics } from './providers/heuristic.provider'
import { calculateCompositeScore } from './composite-score'
import type { CompositeResult } from './types'

export type { Classification, CompositeResult, HeuristicMetrics } from './types'
export { classifyScore, getClassificationLabel, getClassificationColor } from './composite-score'
export { isGPTZeroConfigured }

export interface DetectionOptions {
  skipGPTZero?: boolean
}

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
