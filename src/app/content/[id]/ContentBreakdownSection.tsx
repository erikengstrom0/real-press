'use client'

import { useEffect, useState } from 'react'
import { BreakdownPanel, type ExplainabilityBreakdown } from '@/components/explainability/BreakdownPanel'
import { BreakdownTeaser } from '@/components/explainability/BreakdownTeaser'
import styles from './page.module.css'

interface ContentBreakdownSectionProps {
  contentId: string
  hasExplainability: boolean
}

interface BreakdownApiResponse {
  hasExplainability: boolean
  score?: number
  classification?: string
  confidence?: number
  analyzedTypes?: string[]
  breakdown?: {
    providers: Array<{
      name: string
      type: string
      score: number
      confidence: number
      isPrimary: boolean
      metrics?: Record<string, { value: number; signal: string; humanRange: string }>
    }>
    images?: Array<{ index: number; url?: string | null; score: number; confidence: number }>
    videoTimeline?: Array<{ index: number; timestamp: number; score: number; confidence: number }>
    fusion: {
      method: string
      weights: Array<{
        type: string
        baseWeight: number
        effectiveWeight: number
        contribution: string
      }>
    }
    providerAgreement: 'agree' | 'mixed' | 'disagree'
  }
  message?: string
}

/**
 * Client component that fetches breakdown data and renders the appropriate
 * explainability view based on user tier.
 *
 * Since check-tier.ts currently stubs to 'free', we allow overriding via
 * an X-User-Tier header for demo/development purposes.
 */
export function ContentBreakdownSection({
  contentId,
  hasExplainability,
}: ContentBreakdownSectionProps) {
  const [data, setData] = useState<BreakdownApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasExplainability) return

    setLoading(true)
    // For demo purposes, request as 'pro' tier so the breakdown is visible.
    // In production, the tier will be determined by the user's subscription.
    fetch(`/api/content/${contentId}/breakdown`, {
      headers: { 'X-User-Tier': 'pro' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch breakdown')
        return res.json()
      })
      .then((json: BreakdownApiResponse) => {
        setData(json)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error')
      })
      .finally(() => setLoading(false))
  }, [contentId, hasExplainability])

  if (!hasExplainability) {
    return (
      <div className={styles.breakdownSection}>
        <p className={styles.noExplainability}>
          This content was analyzed before detailed tracking was available.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.breakdownSection}>
        <p className={styles.loading}>Loading analysis details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.breakdownSection}>
        <p className={styles.error}>Could not load analysis details.</p>
      </div>
    )
  }

  if (!data) return null

  // If we got a full breakdown (pro tier), render BreakdownPanel
  if (data.breakdown) {
    const breakdown: ExplainabilityBreakdown = {
      explanation: generateExplanationFromData(data),
      providerAgreement: data.breakdown.providerAgreement,
      providers: data.breakdown.providers,
      heuristicMetrics: extractHeuristicMetrics(data.breakdown.providers),
      images: data.breakdown.images?.map((img) => ({
        index: img.index,
        url: img.url ?? undefined,
        score: img.score,
        confidence: img.confidence,
      })),
      frames: data.breakdown.videoTimeline,
      fusion: {
        method: data.breakdown.fusion.method,
        weights: data.breakdown.fusion.weights.map((w) => ({
          ...w,
          score: 0, // Not exposed by the API (anti-gaming)
        })),
      },
      paragraphScores: extractParagraphScores(data.breakdown.providers),
    }

    return (
      <div className={styles.breakdownSection}>
        <BreakdownPanel breakdown={breakdown} />
      </div>
    )
  }

  // Free tier — show teaser
  return (
    <div className={styles.breakdownSection}>
      <BreakdownTeaser />
    </div>
  )
}

/**
 * Generate a plain-English explanation from the API response data.
 */
function generateExplanationFromData(data: BreakdownApiResponse): string {
  if (!data.breakdown) return ''

  const classification = data.classification ?? 'unsure'
  const labels: Record<string, string> = {
    human: 'Verified Authentic',
    likely_human: 'Likely Authentic',
    unsure: 'Inconclusive',
    likely_ai: 'Likely AI-Generated',
    ai: 'AI-Generated',
  }
  const label = labels[classification] ?? 'Inconclusive'
  const agreement = data.breakdown.providerAgreement

  if (agreement === 'agree') {
    return `This article is ${label}. All detection methods agreed on this assessment.`
  }
  if (agreement === 'disagree') {
    return `This article is ${label}. The detection methods disagreed on their assessment, which affected confidence in the result.`
  }
  return `This article is ${label}. The detection methods showed some variation in their assessment.`
}

/**
 * Extract heuristic metrics from the heuristic provider entry.
 */
function extractHeuristicMetrics(
  providers: BreakdownApiResponse['breakdown'] extends undefined ? never : NonNullable<BreakdownApiResponse['breakdown']>['providers']
) {
  const heuristic = providers.find((p) => p.name === 'heuristic')
  if (!heuristic?.metrics) return undefined

  const m = heuristic.metrics
  return {
    vocabularyDiversity: toMetricSignal(m.vocabularyDiversity),
    sentenceLengthVariation: toMetricSignal(m.sentenceLengthVariation),
    avgSentenceLength: toMetricSignal(m.avgSentenceLength),
    punctuationVariety: toMetricSignal(m.punctuationVariety),
  }
}

function toMetricSignal(metric?: { value: number; signal: string; humanRange: string }) {
  if (!metric) return { value: 0, signal: 'neutral' as const, humanRange: 'varies' }
  return {
    value: metric.value,
    signal: metric.signal as 'low' | 'neutral' | 'high',
    humanRange: metric.humanRange,
  }
}

/**
 * Extract GPTZero paragraph scores if available.
 */
function extractParagraphScores(
  providers: BreakdownApiResponse['breakdown'] extends undefined ? never : NonNullable<BreakdownApiResponse['breakdown']>['providers']
): Array<{ index: number; score: number }> | undefined {
  const gptzero = providers.find((p) => p.name === 'gptzero')
  if (!gptzero?.metrics) return undefined

  // Paragraph scores are not exposed through the standard metrics format;
  // they would need to be passed through provider metadata.
  // For now, return undefined — this will be populated when GPTZero is available.
  return undefined
}
