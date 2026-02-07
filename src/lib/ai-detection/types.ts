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
    huggingfaceAvailable?: boolean
    primaryProvider?: string | null
    heuristicMetrics?: HeuristicMetrics
    // Phase 7: enriched metadata
    heuristicFeatureScores?: HeuristicFeatureScores
    heuristicFeatureWeights?: HeuristicFeatureWeights
    apiWeight?: number
    heuristicWeight?: number
    providerResults?: Record<string, unknown>[]
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
 * Phase 7: Enriched metadata interfaces for explainability
 */

export interface HeuristicFeatureScores {
  vocabularyScore: number
  variationScore: number
  punctuationScore: number
  lengthScore: number
}

export interface HeuristicFeatureWeights {
  vocabulary: number // 0.35
  variation: number // 0.30
  punctuation: number // 0.15
  length: number // 0.20
}

export interface StoredHeuristicMetrics extends HeuristicMetrics {
  featureScores: HeuristicFeatureScores
  featureWeights: HeuristicFeatureWeights
}

export interface StoredProviderDetail {
  name: string
  type: string
  score: number
  confidence: number
  isPrimary: boolean
  available: boolean
  metadata?: {
    // HuggingFace-specific
    model?: string
    truncated?: boolean
    labels?: Array<{ label: string; score: number }>
    // GPTZero-specific
    burstiness?: number
    averageGeneratedProb?: number
    completelyGeneratedProb?: number
    paragraphScores?: Array<{ index: number; score: number }>
    // Image-specific
    imageUrl?: string
    imageIndex?: number
    // Video-specific
    frameIndex?: number
    frameTimestamp?: number
  }
}

export interface StoredFusionDetails {
  method: 'text_only' | 'multi_modal'
  textFusion?: {
    primaryProvider: string
    apiWeight: number
    heuristicWeight: number
    apiScore: number
    heuristicScore: number
  }
  modalityWeights?: ModalityWeight[]
  totalEffectiveWeight?: number
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

export interface ModalityWeight {
  type: string
  baseWeight: number
  confidence: number
  effectiveWeight: number
  contribution: number
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
    // Phase 7: enriched metadata
    modalityWeights?: ModalityWeight[]
    totalEffectiveWeight?: number
  }
}

