/**
 * AI Detection Types
 *
 * Score values: 0.0 = definitely human, 1.0 = definitely AI
 */

export type Classification = 'human' | 'likely_human' | 'unsure' | 'likely_ai' | 'ai'

/**
 * Content types supported by the multi-modal detection system
 */
export type ContentType = 'text' | 'image' | 'video'

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

/**
 * Multi-Modal Input Types
 */
export interface ImageInput {
  url?: string
  base64?: string
}

export interface VideoInput {
  url: string
}

export interface MultiModalInput {
  text?: string
  images?: ImageInput[]
  video?: VideoInput
}

/**
 * Score for a single content type
 */
export interface ContentTypeScore {
  type: ContentType
  score: number
  confidence: number
  providerName: string
  metadata?: Record<string, unknown>
}

/**
 * Result from multi-modal analysis
 */
export interface MultiModalResult {
  compositeScore: number
  classification: Classification
  contentScores: ContentTypeScore[]
  analyzedTypes: ContentType[]
  metadata?: {
    textScore?: number
    textConfidence?: number
    imageScore?: number
    imageConfidence?: number
    videoScore?: number
    videoConfidence?: number
  }
}
