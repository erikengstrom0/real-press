/**
 * Plain-English Score Explanation Generator
 *
 * Produces 2-3 sentences explaining an AI detection score in
 * non-technical, user-friendly language. No numbers, no percentages,
 * no jargon.
 */

import type { Classification } from './types'
import type { ExplainabilityBreakdown, BreakdownSignal } from './format-breakdown'

// ---------------------------------------------------------------------------
// User-friendly classification labels
// ---------------------------------------------------------------------------

const FRIENDLY_LABELS: Record<Classification, string> = {
  human: 'Verified Authentic',
  likely_human: 'Likely Authentic',
  unsure: 'Inconclusive',
  likely_ai: 'Likely AI-Generated',
  ai: 'AI-Generated',
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a plain-English explanation of the detection score.
 *
 * Rules:
 * - Start with the classification in user-friendly terms.
 * - If providers agree: mention agreement. If disagree: mention disagreement.
 * - Mention 1-2 notable heuristic signals (whichever are 'low' or 'high').
 * - If images were analyzed: mention whether they contributed to or contradicted the text score.
 * - Keep it concise and non-technical.
 */
export function generateExplanation(breakdown: ExplainabilityBreakdown): string {
  const label = FRIENDLY_LABELS[breakdown.classification] ?? 'Inconclusive'

  const parts: string[] = []

  // Sentence 1: Classification + provider agreement
  parts.push(buildOpeningSentence(label, breakdown))

  // Sentence 2: Notable heuristic signals
  const heuristicSentence = buildHeuristicSentence(breakdown)
  if (heuristicSentence) {
    parts.push(heuristicSentence)
  }

  // Sentence 3: Image contribution (if images were analyzed)
  const imageSentence = buildImageSentence(breakdown)
  if (imageSentence) {
    parts.push(imageSentence)
  }

  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildOpeningSentence(
  label: string,
  breakdown: ExplainabilityBreakdown,
): string {
  const agreement = breakdown.breakdown.providerAgreement

  if (agreement === 'agree') {
    return `This article is ${label}. All detection methods agreed on this assessment.`
  }

  if (agreement === 'disagree') {
    return `This article is ${label}. The detection methods disagreed on their assessment, which affected confidence in the result.`
  }

  // 'mixed'
  return `This article is ${label}. The detection methods showed some variation in their assessment.`
}

function buildHeuristicSentence(breakdown: ExplainabilityBreakdown): string | null {
  // Find the heuristic provider entry
  const heuristicProvider = breakdown.breakdown.providers.find((p) => p.name === 'heuristic')
  if (!heuristicProvider?.metrics) return null

  const metrics = heuristicProvider.metrics
  const notable: { name: string; signal: BreakdownSignal }[] = []

  for (const [key, result] of Object.entries(metrics)) {
    if (result.signal === 'low' || result.signal === 'high') {
      notable.push({ name: key, signal: result.signal })
    }
  }

  if (notable.length === 0) {
    return 'The writing style analysis found patterns consistent with typical expectations.'
  }

  // Pick up to 2 notable signals
  const selected = notable.slice(0, 2)
  const descriptions = selected.map((n) => describeMetric(n.name, n.signal))

  if (isHumanLeaning(breakdown.classification)) {
    return `The writing shows ${joinNatural(descriptions)}.`
  }

  return `The text analysis flagged ${joinNatural(descriptions)}.`
}

function buildImageSentence(breakdown: ExplainabilityBreakdown): string | null {
  if (!breakdown.analyzedTypes.includes('image')) return null
  if (!breakdown.breakdown.images || breakdown.breakdown.images.length === 0) return null

  const images = breakdown.breakdown.images
  const avgImageScore = images.reduce((sum, img) => sum + img.score, 0) / images.length
  const textIsAiLeaning = breakdown.score > 0.5

  const imagesAiLeaning = avgImageScore > 0.5

  if (textIsAiLeaning && !imagesAiLeaning) {
    return 'However, the analyzed images appeared authentic, which moderated the overall score.'
  }

  if (!textIsAiLeaning && imagesAiLeaning) {
    return 'However, some analyzed images showed signs of AI generation, which affected the overall score.'
  }

  if (textIsAiLeaning && imagesAiLeaning) {
    return 'The analyzed images also showed signs consistent with AI generation.'
  }

  return 'The analyzed images also appeared authentic, supporting the overall assessment.'
}

function describeMetric(name: string, signal: BreakdownSignal): string {
  const descriptions: Record<string, Record<string, string>> = {
    vocabularyDiversity: {
      high: 'strong vocabulary diversity',
      low: 'limited vocabulary range',
    },
    sentenceVariation: {
      high: 'natural sentence rhythm',
      low: 'unusually uniform sentence structure',
    },
    avgSentenceLength: {
      high: 'notably long sentences',
      low: 'notably short sentences',
    },
    punctuationVariety: {
      high: 'varied punctuation usage',
      low: 'limited punctuation variety',
    },
  }

  return descriptions[name]?.[signal] ?? 'an unusual writing pattern'
}

function isHumanLeaning(classification: Classification): boolean {
  return classification === 'human' || classification === 'likely_human'
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items[0]} and ${items[1]}`
}
