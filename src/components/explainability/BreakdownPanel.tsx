'use client'

import styles from './BreakdownPanel.module.css'
import { ProviderAgreement } from './ProviderAgreement'
import { HeuristicRadar } from './HeuristicRadar'
import { ModalityBreakdown } from './ModalityBreakdown'
import { ImageGrid } from './ImageGrid'
import { FrameTimeline } from './FrameTimeline'
import { ParagraphHighlighter } from './ParagraphHighlighter'

/* ── Local type definitions ── */

interface MetricSignal {
  value: number
  signal: 'low' | 'neutral' | 'high'
  humanRange: string
}

interface ProviderDetail {
  name: string
  type: string
  score: number
  confidence: number
  isPrimary: boolean
}

interface ImageScore {
  index: number
  url?: string
  score: number
  confidence: number
}

interface FrameScore {
  index: number
  timestamp?: number
  score: number
  confidence: number
}

interface FusionWeight {
  type: string
  baseWeight: number
  effectiveWeight: number
  contribution: string
  score: number
}

export interface ExplainabilityBreakdown {
  explanation: string
  providerAgreement: 'agree' | 'mixed' | 'disagree'
  providers: ProviderDetail[]
  heuristicMetrics?: {
    vocabularyDiversity: MetricSignal
    sentenceLengthVariation: MetricSignal
    avgSentenceLength: MetricSignal
    punctuationVariety: MetricSignal
  }
  images?: ImageScore[]
  frames?: FrameScore[]
  variancePenalty?: number
  fusion: {
    method: string
    weights: FusionWeight[]
  }
  paragraphScores?: Array<{ index: number; score: number }>
}

interface BreakdownPanelProps {
  breakdown: ExplainabilityBreakdown
  contentText?: string
}

export function BreakdownPanel({ breakdown, contentText }: BreakdownPanelProps) {
  return (
    <div className={styles.panel}>
      <h3 className={styles.header}>Why This Score?</h3>
      <div className={styles.headerRule} />

      <p className={styles.explanation}>{breakdown.explanation}</p>

      <div className={styles.section}>
        <ProviderAgreement
          agreement={breakdown.providerAgreement}
          providers={breakdown.providers}
        />
      </div>

      {breakdown.heuristicMetrics && (
        <div className={styles.section}>
          <HeuristicRadar metrics={breakdown.heuristicMetrics} />
        </div>
      )}

      <div className={styles.section}>
        <ModalityBreakdown weights={breakdown.fusion.weights} />
      </div>

      {breakdown.images && breakdown.images.length > 0 && (
        <div className={styles.section}>
          <ImageGrid images={breakdown.images} />
        </div>
      )}

      {breakdown.frames && breakdown.frames.length > 0 && (
        <div className={styles.section}>
          <FrameTimeline
            frames={breakdown.frames}
            variancePenalty={breakdown.variancePenalty}
          />
        </div>
      )}

      {contentText && breakdown.paragraphScores && breakdown.paragraphScores.length > 0 && (
        <div className={styles.section}>
          <ParagraphHighlighter
            text={contentText}
            paragraphScores={breakdown.paragraphScores}
          />
        </div>
      )}
    </div>
  )
}

/*
 * Example mock props:
 * {
 *   breakdown: {
 *     explanation: "This article scored as Verified Authentic. All three detection providers agreed.",
 *     providerAgreement: 'agree',
 *     providers: [
 *       { name: 'huggingface', type: 'text', score: 0.12, confidence: 0.91, isPrimary: true },
 *       { name: 'heuristic', type: 'text', score: 0.18, confidence: 0.72, isPrimary: false },
 *     ],
 *     heuristicMetrics: {
 *       vocabularyDiversity: { value: 0.68, signal: 'high', humanRange: '0.4-0.7' },
 *       sentenceLengthVariation: { value: 0.55, signal: 'high', humanRange: '0.3-0.6' },
 *       avgSentenceLength: { value: 17.2, signal: 'neutral', humanRange: 'varies' },
 *       punctuationVariety: { value: 0.75, signal: 'high', humanRange: '0.5-1.0' },
 *     },
 *     images: [
 *       { index: 0, url: '/sample.jpg', score: 0.20, confidence: 0.82 },
 *       { index: 1, url: '/sample2.jpg', score: 0.08, confidence: 0.90 },
 *     ],
 *     fusion: {
 *       method: 'multi_modal',
 *       weights: [
 *         { type: 'text', baseWeight: 0.50, effectiveWeight: 0.455, contribution: '62%', score: 0.15 },
 *         { type: 'image', baseWeight: 0.35, effectiveWeight: 0.280, contribution: '38%', score: 0.14 },
 *       ],
 *     },
 *   },
 *   contentText: "First paragraph.\n\nSecond paragraph.",
 * }
 */
