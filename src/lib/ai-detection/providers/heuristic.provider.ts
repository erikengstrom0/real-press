/**
 * Heuristic AI Detection Provider
 *
 * Uses stylometric analysis to detect AI-generated content.
 * Score: 0.0 = human-like, 1.0 = AI-like
 *
 * Key indicators of AI-generated text:
 * - Low vocabulary diversity (repetitive word choices)
 * - Uniform sentence lengths (less variation)
 * - Predictable punctuation patterns
 * - Overly structured paragraphs
 */

import type { ProviderResult, HeuristicMetrics } from '../types'
import { BaseProvider, type ProviderInput, type ProviderCapabilities } from './base.provider'

const MIN_WORDS_FOR_ANALYSIS = 50

/**
 * Heuristic Provider Class
 * Extends BaseProvider for multi-modal architecture compatibility
 */
export class HeuristicProvider extends BaseProvider {
  readonly name = 'heuristic'
  readonly capabilities: ProviderCapabilities = {
    contentTypes: ['text'],
  }

  isAvailable(): boolean {
    // Heuristics are always available - no external dependencies
    return true
  }

  async analyze(input: ProviderInput): Promise<ProviderResult | null> {
    if (input.type !== 'text' || !input.text) {
      return null
    }
    const result = await analyzeWithHeuristics(input.text)
    return {
      score: result.score,
      confidence: result.confidence,
      metadata: { metrics: result.metrics },
    }
  }
}

// Legacy function export for backwards compatibility
export async function analyzeWithHeuristics(text: string): Promise<ProviderResult & { metrics: HeuristicMetrics }> {
  const cleanText = text.trim()
  const words = tokenizeWords(cleanText)
  const sentences = tokenizeSentences(cleanText)

  if (words.length < MIN_WORDS_FOR_ANALYSIS) {
    return {
      score: 0.5,
      confidence: 0.3,
      metrics: getEmptyMetrics(words.length),
    }
  }

  const metrics = calculateMetrics(words, sentences, cleanText)
  const score = calculateScore(metrics)

  return {
    score,
    confidence: calculateConfidence(words.length, sentences.length),
    metrics,
  }
}

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)
}

function tokenizeSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function calculateMetrics(words: string[], sentences: string[], text: string): HeuristicMetrics {
  const uniqueWords = new Set(words)
  const vocabularyDiversity = uniqueWords.size / words.length

  const sentenceLengths = sentences.map((s) => tokenizeWords(s).length)
  const avgSentenceLength =
    sentenceLengths.length > 0
      ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
      : 0

  const sentenceLengthVariation = calculateVariation(sentenceLengths)

  const punctuationMarks = text.match(/[,;:'"()\-—]/g) || []
  const uniquePunctuation = new Set(punctuationMarks)
  const punctuationVariety = punctuationMarks.length > 0 ? uniquePunctuation.size / 8 : 0

  const paragraphCount = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length

  return {
    vocabularyDiversity,
    sentenceLengthVariation,
    avgSentenceLength,
    punctuationVariety: Math.min(punctuationVariety, 1),
    paragraphCount: Math.max(paragraphCount, 1),
    wordCount: words.length,
  }
}

function calculateVariation(values: number[]): number {
  if (values.length < 2) return 0

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
  const stdDev = Math.sqrt(variance)

  // Coefficient of variation (normalized)
  return mean > 0 ? Math.min(stdDev / mean, 1) : 0
}

function calculateScore(metrics: HeuristicMetrics): number {
  // AI-generated text tends to have:
  // - Lower vocabulary diversity (score increases)
  // - More uniform sentence lengths (score increases)
  // - Less punctuation variety (score increases)

  // Vocabulary diversity: human text typically 0.4-0.7, AI tends to be lower
  // Invert so lower diversity = higher AI score
  const vocabScore = 1 - Math.min(metrics.vocabularyDiversity / 0.6, 1)

  // Sentence variation: human text has more variation (0.3-0.6 CV)
  // AI text tends to be more uniform (0.1-0.3 CV)
  // Invert so lower variation = higher AI score
  const variationScore = 1 - Math.min(metrics.sentenceLengthVariation / 0.5, 1)

  // Punctuation variety: humans use more diverse punctuation
  // Invert so lower variety = higher AI score
  const punctuationScore = 1 - metrics.punctuationVariety

  // Average sentence length: AI tends toward medium lengths (15-25 words)
  // Human text has more extreme variation
  const idealAiLength = 20
  const lengthDeviation = Math.abs(metrics.avgSentenceLength - idealAiLength)
  const lengthScore = 1 - Math.min(lengthDeviation / 15, 1)

  // Weighted combination
  const weights = {
    vocab: 0.35,
    variation: 0.30,
    punctuation: 0.15,
    length: 0.20,
  }

  const score =
    vocabScore * weights.vocab +
    variationScore * weights.variation +
    punctuationScore * weights.punctuation +
    lengthScore * weights.length

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score))
}

function calculateConfidence(wordCount: number, sentenceCount: number): number {
  // Confidence increases with more text to analyze
  const wordConfidence = Math.min(wordCount / 500, 1)
  const sentenceConfidence = Math.min(sentenceCount / 20, 1)

  return (wordConfidence * 0.7 + sentenceConfidence * 0.3) * 0.8 // Max 80% confidence for heuristics
}

function getEmptyMetrics(wordCount: number): HeuristicMetrics {
  return {
    vocabularyDiversity: 0,
    sentenceLengthVariation: 0,
    avgSentenceLength: 0,
    punctuationVariety: 0,
    paragraphCount: 1,
    wordCount,
  }
}
