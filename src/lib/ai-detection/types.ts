/**
 * AI Detection Types
 *
 * Score values: 0.0 = definitely human, 1.0 = definitely AI
 */

export type Classification = 'human' | 'likely_human' | 'unsure' | 'likely_ai' | 'ai'

export interface DetectionResult {
  score: number
  classification: Classification
  confidence: number
}

export interface ProviderResult {
  score: number
  confidence: number
  metadata?: Record<string, unknown>
}

export interface CompositeResult {
  compositeScore: number
  classification: Classification
  gptzeroScore: number | null
  heuristicScore: number
  metadata?: {
    gptzeroAvailable: boolean
    heuristicMetrics?: HeuristicMetrics
  }
}

export interface HeuristicMetrics {
  vocabularyDiversity: number
  sentenceLengthVariation: number
  avgSentenceLength: number
  punctuationVariety: number
  paragraphCount: number
  wordCount: number
}
