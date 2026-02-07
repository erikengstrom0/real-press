/**
 * Response Formatting & Tier Logic
 *
 * Transforms raw stored JSONB data into structured free/paid API responses.
 * All functions are pure — no database calls, no side effects.
 *
 * IMPORTANT: Never expose raw thresholds, scoring formulas, or feature weights.
 * Only expose signal levels and human-expected ranges.
 */

import type {
  Classification,
  ContentType,
  StoredProviderDetail,
  StoredHeuristicMetrics,
  StoredFusionDetails,
} from './types'

// ---------------------------------------------------------------------------
// Input row types (match DB column shapes without importing Prisma)
// ---------------------------------------------------------------------------

export interface AiScoreRow {
  compositeScore: number
  classification: Classification
  providerDetails?: StoredProviderDetail[] | null
  heuristicMetrics?: StoredHeuristicMetrics | null
  fusionDetails?: StoredFusionDetails | null
  /** Per-type scores stored on AiScore (text, image, video) */
  textScore?: number | null
  textConfidence?: number | null
  imageScore?: number | null
  imageConfidence?: number | null
  videoScore?: number | null
  videoConfidence?: number | null
  analyzedTypes?: ContentType[] | null
}

export interface MediaScoreRow {
  id: string
  mediaType: string // 'image' | 'video'
  score: number
  confidence: number
  providerName: string
  /** URL of the image (from ContentMedia) */
  url?: string | null
  /** Per-frame scores for video (JSONB) */
  frameScores?: FrameScore[] | null
}

export interface FrameScore {
  index: number
  timestamp: number
  score: number
  confidence: number
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type BreakdownSignal = 'low' | 'neutral' | 'high'

export type ProviderAgreement = 'agree' | 'mixed' | 'disagree'

export interface MetricSignalResult {
  value: number
  signal: BreakdownSignal
  humanRange: string
}

export interface ExplainabilityBreakdown {
  score: number
  classification: Classification
  confidence: number
  analyzedTypes: ContentType[]
  breakdown: {
    providers: ProviderBreakdownEntry[]
    images?: ImageBreakdownEntry[]
    videoTimeline?: FrameTimelineEntry[]
    fusion: FusionBreakdown
    providerAgreement: ProviderAgreement
  }
}

export interface ProviderBreakdownEntry {
  name: string
  type: string
  score: number
  confidence: number
  isPrimary: boolean
  metrics?: Record<string, MetricSignalResult>
}

export interface ImageBreakdownEntry {
  index: number
  url?: string | null
  score: number
  confidence: number
}

export interface FrameTimelineEntry {
  index: number
  timestamp: number
  score: number
  confidence: number
}

export interface FusionBreakdown {
  method: 'text_only' | 'multi_modal'
  weights: FusionWeightEntry[]
}

export interface FusionWeightEntry {
  type: string
  baseWeight: number
  effectiveWeight: number
  contribution: string // e.g. "62%"
}

export interface FreeResponse {
  score: number
  classification: Classification
  confidence: number
  analyzedTypes: ContentType[]
}

// ---------------------------------------------------------------------------
// Metric signal thresholds (human-baseline ranges)
// ---------------------------------------------------------------------------

interface MetricRange {
  lowBelow: number
  highAbove: number
  humanRange: string
}

const METRIC_RANGES: Record<string, MetricRange> = {
  vocabularyDiversity: { lowBelow: 0.35, highAbove: 0.55, humanRange: '0.4-0.7' },
  sentenceLengthVariation: { lowBelow: 0.20, highAbove: 0.45, humanRange: '0.3-0.6' },
  avgSentenceLength: { lowBelow: 12, highAbove: 25, humanRange: '12-25' },
  punctuationVariety: { lowBelow: 0.30, highAbove: 0.60, humanRange: '0.5-1.0' },
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format a response for free-tier users.
 * Strips all breakdown data — returns only the verdict.
 */
export function formatFreeResponse(aiScore: AiScoreRow): FreeResponse {
  return {
    score: aiScore.compositeScore,
    classification: aiScore.classification,
    confidence: deriveConfidence(aiScore),
    analyzedTypes: aiScore.analyzedTypes ?? ['text'],
  }
}

/**
 * Format a response for paid-tier users (Pro / Enterprise).
 * Includes the full explainability breakdown.
 */
export function formatPaidResponse(
  aiScore: AiScoreRow,
  mediaScores?: MediaScoreRow[],
): ExplainabilityBreakdown {
  const providers = aiScore.providerDetails ?? []
  const heuristics = aiScore.heuristicMetrics ?? null
  const fusion = aiScore.fusionDetails ?? null

  const providerEntries = formatProviders(providers, heuristics)

  const imageEntries = mediaScores ? formatImageBreakdown(mediaScores) : undefined
  const videoTimeline = mediaScores ? formatVideoTimeline(mediaScores) : undefined

  const fusionBreakdown = fusion
    ? formatFusionDetails(fusion)
    : { method: 'text_only' as const, weights: [] }

  return {
    score: aiScore.compositeScore,
    classification: aiScore.classification,
    confidence: deriveConfidence(aiScore),
    analyzedTypes: aiScore.analyzedTypes ?? ['text'],
    breakdown: {
      providers: providerEntries,
      ...(imageEntries && imageEntries.length > 0 ? { images: imageEntries } : {}),
      ...(videoTimeline && videoTimeline.length > 0 ? { videoTimeline } : {}),
      fusion: fusionBreakdown,
      providerAgreement: computeProviderAgreement(providers),
    },
  }
}

/**
 * Compute provider agreement from text providers.
 * Only considers text-type providers (ignores image/video).
 */
export function computeProviderAgreement(providers: StoredProviderDetail[]): ProviderAgreement {
  const textProviders = providers.filter((p) => p.type === 'text' && p.available)

  if (textProviders.length < 2) {
    return 'agree' // single provider trivially agrees with itself
  }

  const scores = textProviders.map((p) => p.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const spread = max - min

  if (spread <= 0.15) return 'agree'
  if (spread > 0.30) return 'disagree'
  return 'mixed'
}

/**
 * Map a heuristic metric to a human-readable signal.
 * Does NOT expose scoring formulas or feature weights.
 */
export function metricToSignal(metricName: string, value: number): MetricSignalResult {
  const range = METRIC_RANGES[metricName]

  if (!range) {
    return { value, signal: 'neutral', humanRange: 'varies' }
  }

  let signal: BreakdownSignal = 'neutral'
  if (value < range.lowBelow) signal = 'low'
  else if (value > range.highAbove) signal = 'high'

  return { value, signal, humanRange: range.humanRange }
}

/**
 * Format per-image scores from MediaScore rows.
 * Filters to image-type entries only.
 */
export function formatImageBreakdown(mediaScores: MediaScoreRow[]): ImageBreakdownEntry[] {
  return mediaScores
    .filter((ms) => ms.mediaType === 'image')
    .map((ms, index) => ({
      index,
      url: ms.url ?? null,
      score: ms.score,
      confidence: ms.confidence,
    }))
}

/**
 * Format fusion details with contribution percentages.
 */
export function formatFusionDetails(fusionDetails: StoredFusionDetails): FusionBreakdown {
  if (fusionDetails.modalityWeights && fusionDetails.modalityWeights.length > 0) {
    const totalEffective =
      fusionDetails.totalEffectiveWeight ??
      fusionDetails.modalityWeights.reduce((sum, w) => sum + w.effectiveWeight, 0)

    return {
      method: fusionDetails.method,
      weights: fusionDetails.modalityWeights.map((w) => ({
        type: w.type,
        baseWeight: w.baseWeight,
        effectiveWeight: w.effectiveWeight,
        contribution:
          totalEffective > 0
            ? `${Math.round((w.effectiveWeight / totalEffective) * 100)}%`
            : '0%',
      })),
    }
  }

  // text_only fusion — build a single text entry from textFusion data
  if (fusionDetails.textFusion) {
    const tf = fusionDetails.textFusion
    return {
      method: 'text_only',
      weights: [
        {
          type: 'text',
          baseWeight: 1.0,
          effectiveWeight: 1.0,
          contribution: '100%',
        },
      ],
    }
  }

  return { method: fusionDetails.method, weights: [] }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive an overall confidence value from the score row.
 */
function deriveConfidence(aiScore: AiScoreRow): number {
  // Use text confidence as primary; fall back to averaging available confidences
  if (aiScore.textConfidence != null) {
    return aiScore.textConfidence
  }

  const confidences: number[] = []
  if (aiScore.providerDetails) {
    for (const p of aiScore.providerDetails) {
      if (p.available && p.confidence != null) {
        confidences.push(p.confidence)
      }
    }
  }

  if (confidences.length === 0) return 0.5
  return confidences.reduce((a, b) => a + b, 0) / confidences.length
}

/**
 * Format providers into breakdown entries, attaching heuristic signals
 * to the heuristic provider entry.
 */
function formatProviders(
  providers: StoredProviderDetail[],
  heuristics: StoredHeuristicMetrics | null,
): ProviderBreakdownEntry[] {
  return providers
    .filter((p) => p.available)
    .map((p) => {
      const entry: ProviderBreakdownEntry = {
        name: p.name,
        type: p.type,
        score: p.score,
        confidence: p.confidence,
        isPrimary: p.isPrimary,
      }

      // Attach heuristic metric signals to the heuristic provider
      if (p.name === 'heuristic' && heuristics) {
        entry.metrics = {
          vocabularyDiversity: metricToSignal('vocabularyDiversity', heuristics.vocabularyDiversity),
          sentenceLengthVariation: metricToSignal(
            'sentenceLengthVariation',
            heuristics.sentenceLengthVariation,
          ),
          avgSentenceLength: metricToSignal('avgSentenceLength', heuristics.avgSentenceLength),
          punctuationVariety: metricToSignal('punctuationVariety', heuristics.punctuationVariety),
        }
      }

      return entry
    })
}

/**
 * Extract per-frame video timeline from MediaScore rows.
 */
function formatVideoTimeline(mediaScores: MediaScoreRow[]): FrameTimelineEntry[] {
  const videoEntries = mediaScores.filter(
    (ms) => ms.mediaType === 'video' && ms.frameScores && ms.frameScores.length > 0,
  )

  const frames: FrameTimelineEntry[] = []
  for (const entry of videoEntries) {
    if (entry.frameScores) {
      for (const frame of entry.frameScores) {
        frames.push({
          index: frame.index,
          timestamp: frame.timestamp,
          score: frame.score,
          confidence: frame.confidence,
        })
      }
    }
  }

  return frames.sort((a, b) => a.index - b.index)
}
