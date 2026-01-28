/**
 * Composite Score Calculator
 *
 * Combines scores from multiple detection providers into a single score.
 * Uses weighted averaging with confidence-based adjustments.
 */

import type { Classification, CompositeResult, HeuristicMetrics } from './types'

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

export function calculateCompositeScore(input: ScoreInput): CompositeResult {
  const { gptzeroScore, gptzeroConfidence, heuristicScore, heuristicConfidence, heuristicMetrics } =
    input

  let compositeScore: number

  if (gptzeroScore !== null && gptzeroConfidence !== null) {
    // Both providers available - use confidence-weighted average
    const gptzeroWeight = GPTZERO_BASE_WEIGHT * gptzeroConfidence
    const heuristicWeight = HEURISTIC_BASE_WEIGHT * heuristicConfidence

    const totalWeight = gptzeroWeight + heuristicWeight

    compositeScore =
      (gptzeroScore * gptzeroWeight + heuristicScore * heuristicWeight) / totalWeight
  } else {
    // GPTZero unavailable - fall back to heuristics only
    compositeScore = heuristicScore
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
