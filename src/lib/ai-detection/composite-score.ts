/**
 * Composite Score Calculator
 *
 * Combines scores from multiple detection providers into a single score.
 * Uses weighted averaging with confidence-based adjustments.
 */

import type {
  Classification,
  CompositeResult,
  HeuristicMetrics,
  ContentType,
  ContentTypeScore,
  MultiModalResult,
  ModalityWeight,
} from './types'

interface ScoreInput {
  gptzeroScore: number | null
  gptzeroConfidence: number | null
  heuristicScore: number
  heuristicConfidence: number
  heuristicMetrics: HeuristicMetrics
}

// Base weights when both providers are available
const GPTZERO_BASE_WEIGHT = 0.7
const HEURISTIC_BASE_WEIGHT = 0.3

// Base weights for multi-modal content types
const CONTENT_TYPE_WEIGHTS: Record<ContentType, number> = {
  text: 0.5,
  image: 0.35,
  video: 0.15,
}

export function calculateCompositeScore(input: ScoreInput): CompositeResult {
  const { gptzeroScore, gptzeroConfidence, heuristicScore, heuristicConfidence, heuristicMetrics } =
    input

  let compositeScore: number
  let effectiveApiWeight = 0
  let effectiveHeuristicWeight = 0

  if (gptzeroScore !== null && gptzeroConfidence !== null) {
    // Both providers available - use confidence-weighted average
    const gptzeroWeight = GPTZERO_BASE_WEIGHT * gptzeroConfidence
    const heuristicWeight = HEURISTIC_BASE_WEIGHT * heuristicConfidence

    const totalWeight = gptzeroWeight + heuristicWeight

    compositeScore =
      (gptzeroScore * gptzeroWeight + heuristicScore * heuristicWeight) / totalWeight

    // Normalize effective weights to sum to 1
    effectiveApiWeight = gptzeroWeight / totalWeight
    effectiveHeuristicWeight = heuristicWeight / totalWeight
  } else {
    // GPTZero unavailable - fall back to heuristics only
    compositeScore = heuristicScore
    effectiveApiWeight = 0
    effectiveHeuristicWeight = 1
  }

  // Clamp to [0, 1]
  compositeScore = Math.max(0, Math.min(1, compositeScore))

  const classification = classifyScore(compositeScore)

  return {
    compositeScore,
    classification,
    gptzeroScore,
    heuristicScore,
    metadata: {
      gptzeroAvailable: gptzeroScore !== null,
      heuristicMetrics,
      apiWeight: effectiveApiWeight,
      heuristicWeight: effectiveHeuristicWeight,
    },
  }
}

export function classifyScore(score: number): Classification {
  if (score < 0.15) return 'human'
  if (score < 0.35) return 'likely_human'
  if (score < 0.65) return 'unsure'
  if (score < 0.85) return 'likely_ai'
  return 'ai'
}

export function getClassificationLabel(classification: Classification): string {
  const labels: Record<Classification, string> = {
    human: 'Human',
    likely_human: 'Likely Human',
    unsure: 'Unsure',
    likely_ai: 'Likely AI',
    ai: 'AI Generated',
  }
  return labels[classification]
}

export function getClassificationColor(classification: Classification): {
  color: string
  bgColor: string
} {
  const colors: Record<Classification, { color: string; bgColor: string }> = {
    human: { color: '#22c55e', bgColor: '#dcfce7' },
    likely_human: { color: '#84cc16', bgColor: '#ecfccb' },
    unsure: { color: '#eab308', bgColor: '#fef9c3' },
    likely_ai: { color: '#f97316', bgColor: '#ffedd5' },
    ai: { color: '#ef4444', bgColor: '#fee2e2' },
  }
  return colors[classification]
}

/**
 * Calculate multi-modal composite score from content type scores.
 *
 * Uses confidence-weighted averaging with base weights per content type:
 * - Text: 50%
 * - Image: 35%
 * - Video: 15%
 *
 * Formula: compositeScore = Σ(typeScore × typeConfidence × baseWeight) / Σ(typeConfidence × baseWeight)
 */
export function calculateMultiModalComposite(contentScores: ContentTypeScore[]): MultiModalResult {
  if (contentScores.length === 0) {
    return {
      compositeScore: 0.5,
      classification: 'unsure',
      contentScores: [],
      analyzedTypes: [],
      metadata: {},
    }
  }

  // Calculate weighted sum
  let weightedSum = 0
  let totalWeight = 0

  const metadata: MultiModalResult['metadata'] = {}
  const modalityWeightsData: Array<{ type: string; baseWeight: number; confidence: number; effectiveWeight: number; score: number }> = []

  for (const score of contentScores) {
    const baseWeight = CONTENT_TYPE_WEIGHTS[score.type] || 0.33
    const effectiveWeight = baseWeight * score.confidence

    weightedSum += score.score * effectiveWeight
    totalWeight += effectiveWeight

    modalityWeightsData.push({
      type: score.type,
      baseWeight,
      confidence: score.confidence,
      effectiveWeight,
      score: score.score,
    })

    // Store per-type scores in metadata
    if (score.type === 'text') {
      metadata.textScore = score.score
      metadata.textConfidence = score.confidence
    } else if (score.type === 'image') {
      metadata.imageScore = score.score
      metadata.imageConfidence = score.confidence
    } else if (score.type === 'video') {
      metadata.videoScore = score.score
      metadata.videoConfidence = score.confidence
    }
  }

  // Calculate final composite score
  const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5

  // Clamp to [0, 1]
  const clampedScore = Math.max(0, Math.min(1, compositeScore))

  const classification = classifyScore(clampedScore)
  const analyzedTypes = contentScores.map((s) => s.type)

  // Build modality weights with contribution percentages
  const modalityWeights: ModalityWeight[] = modalityWeightsData.map((mw) => ({
    type: mw.type,
    baseWeight: mw.baseWeight,
    confidence: mw.confidence,
    effectiveWeight: mw.effectiveWeight,
    contribution: totalWeight > 0 ? mw.effectiveWeight / totalWeight : 0,
  }))

  metadata.modalityWeights = modalityWeights
  metadata.totalEffectiveWeight = totalWeight

  return {
    compositeScore: clampedScore,
    classification,
    contentScores,
    analyzedTypes,
    metadata,
  }
}

/**
 * Aggregate multiple image scores into a single score.
 * Uses confidence-weighted average with variance-based confidence adjustment.
 */
export function aggregateImageScores(
  scores: Array<{ score: number; confidence: number }>
): { score: number; confidence: number } {
  if (scores.length === 0) {
    return { score: 0.5, confidence: 0 }
  }

  if (scores.length === 1) {
    return scores[0]
  }

  // Calculate confidence-weighted average
  let weightedSum = 0
  let totalWeight = 0

  for (const s of scores) {
    weightedSum += s.score * s.confidence
    totalWeight += s.confidence
  }

  const avgScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5

  // Calculate variance to adjust confidence
  // High variance means frames disagree, so lower confidence
  let varianceSum = 0
  for (const s of scores) {
    varianceSum += Math.pow(s.score - avgScore, 2)
  }
  const variance = varianceSum / scores.length
  const stdDev = Math.sqrt(variance)

  // Reduce confidence when frames disagree (high stdDev)
  // stdDev of 0.5 (max for 0-1 range) would halve confidence
  const avgConfidence = totalWeight / scores.length
  const variancePenalty = 1 - Math.min(stdDev * 2, 0.5)
  const adjustedConfidence = avgConfidence * variancePenalty

  return {
    score: avgScore,
    confidence: Math.max(0.1, Math.min(0.95, adjustedConfidence)),
  }
}
