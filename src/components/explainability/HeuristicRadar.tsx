'use client'

import { useState, useMemo } from 'react'
import styles from './HeuristicRadar.module.css'

/* ── Local type definitions ── */

interface MetricSignal {
  value: number
  signal: 'low' | 'neutral' | 'high'
  humanRange: string
}

interface HeuristicRadarProps {
  metrics: {
    vocabularyDiversity: MetricSignal
    sentenceLengthVariation: MetricSignal
    avgSentenceLength: MetricSignal
    punctuationVariety: MetricSignal
  }
}

/* ── Constants ── */

const AXES = [
  {
    key: 'vocabularyDiversity',
    label: 'Vocab Diversity',
    fullLabel: 'Vocabulary Diversity',
    description: 'Variety of words used. AI text tends to repeat words more often.',
  },
  {
    key: 'sentenceLengthVariation',
    label: 'Sentence Rhythm',
    fullLabel: 'Sentence Length Variation',
    description: 'Variation in sentence length. Humans write with more varied rhythm.',
  },
  {
    key: 'avgSentenceLength',
    label: 'Avg Length',
    fullLabel: 'Average Sentence Length',
    description: 'Average words per sentence. AI tends toward uniform lengths.',
  },
  {
    key: 'punctuationVariety',
    label: 'Punctuation',
    fullLabel: 'Punctuation Variety',
    description: 'Range of punctuation marks used. AI typically uses fewer types.',
  },
] as const

const CX = 200
const CY = 165
const RADIUS = 85
const NUM_RINGS = 4

/* ── Helpers ── */

function normalizeValue(key: string, value: number): number {
  if (key === 'avgSentenceLength') return Math.min(value / 40, 1)
  return Math.min(Math.max(value, 0), 1)
}

function parseHumanMidpoint(key: string, range: string): number {
  if (range === 'varies') {
    return key === 'avgSentenceLength' ? 17 / 40 : 0.5
  }
  const parts = range.split('-').map(Number)
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const mid = (parts[0] + parts[1]) / 2
    return key === 'avgSentenceLength' ? mid / 40 : mid
  }
  return 0.5
}

function polar(angleDeg: number, r: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
}

function signalColor(signal: string): string {
  switch (signal) {
    case 'high': return '#249445'
    case 'neutral': return '#8B8680'
    case 'low': return '#A65D5D'
    default: return '#8B8680'
  }
}

/* ── Component ── */

export function HeuristicRadar({ metrics }: HeuristicRadarProps) {
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null)

  const entries = useMemo(() =>
    AXES.map((axis, i) => {
      const metric = metrics[axis.key as keyof typeof metrics]
      const normalized = normalizeValue(axis.key, metric.value)
      const humanMid = parseHumanMidpoint(axis.key, metric.humanRange)
      const angle = (i / AXES.length) * 360

      return {
        ...axis,
        metric,
        normalized,
        humanMid,
        angle,
        point: polar(angle, RADIUS * normalized),
        humanPoint: polar(angle, RADIUS * humanMid),
      }
    }),
    [metrics],
  )

  const articlePoly = entries.map(e => e.point.join(',')).join(' ')
  const humanPoly = entries.map(e => e.humanPoint.join(',')).join(' ')

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>Writing Style Analysis</h4>

      <div className={styles.chartWrapper}>
        <svg
          viewBox="0 0 400 330"
          className={styles.chart}
          role="img"
          aria-label="Writing style radar chart"
        >
          {/* Background rings */}
          {Array.from({ length: NUM_RINGS }, (_, ri) => {
            const r = RADIUS * ((ri + 1) / NUM_RINGS)
            const pts = AXES.map((_, j) =>
              polar((j / AXES.length) * 360, r).join(','),
            ).join(' ')
            return (
              <polygon
                key={`ring-${ri}`}
                points={pts}
                fill="none"
                stroke="#6B665E"
                strokeWidth={ri === NUM_RINGS - 1 ? 1 : 0.5}
                strokeDasharray={ri < NUM_RINGS - 1 ? '2,3' : undefined}
                opacity={0.25}
              />
            )
          })}

          {/* Axis lines */}
          {entries.map((e, i) => {
            const [ex, ey] = polar(e.angle, RADIUS)
            return (
              <line
                key={`ax-${i}`}
                x1={CX} y1={CY}
                x2={ex} y2={ey}
                stroke="#6B665E"
                strokeWidth={0.5}
                opacity={0.3}
              />
            )
          })}

          {/* Human baseline polygon (midpoints of human ranges) */}
          <polygon
            points={humanPoly}
            fill="#249445"
            fillOpacity={0.07}
            stroke="#249445"
            strokeWidth={1}
            strokeDasharray="4,3"
            strokeOpacity={0.35}
          />

          {/* Article values polygon */}
          <polygon
            points={articlePoly}
            fill="#249445"
            fillOpacity={0.18}
            stroke="#249445"
            strokeWidth={2}
          />

          {/* Data points + signal indicator dots */}
          {entries.map((e, i) => {
            const [px, py] = e.point
            const [sx, sy] = polar(e.angle, RADIUS + 14)
            return (
              <g key={`pt-${i}`}>
                <circle
                  cx={px} cy={py} r={4}
                  fill="#249445" stroke="#FAF8F5" strokeWidth={1.5}
                />
                <circle
                  cx={sx} cy={sy} r={5}
                  fill={signalColor(e.metric.signal)}
                  stroke="#FAF8F5" strokeWidth={1}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setActiveTooltip(i)}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() => setActiveTooltip(activeTooltip === i ? null : i)}
                />
              </g>
            )
          })}

          {/* Axis labels */}
          {entries.map((e, i) => {
            const [lx, ly] = polar(e.angle, RADIUS + 32)
            const anchor =
              lx < CX - 10 ? 'end' : lx > CX + 10 ? 'start' : 'middle'
            return (
              <text
                key={`lbl-${i}`}
                x={lx} y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                className={styles.axisLabel}
              >
                {e.label}
              </text>
            )
          })}
        </svg>

        {/* Tooltip */}
        {activeTooltip !== null && (
          <div className={styles.tooltip}>
            <strong>{entries[activeTooltip].fullLabel}</strong>
            <span className={styles.tooltipSignal}>
              Signal: {entries[activeTooltip].metric.signal}
            </span>
            <span className={styles.tooltipRange}>
              Human range: {entries[activeTooltip].metric.humanRange}
            </span>
            <p className={styles.tooltipDesc}>
              {entries[activeTooltip].description}
            </p>
          </div>
        )}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDotGreen} /> Typical of human
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDotYellow} /> Neutral
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDotRed} /> Atypical
        </span>
      </div>
    </div>
  )
}

/*
 * Example mock props:
 * {
 *   metrics: {
 *     vocabularyDiversity: { value: 0.68, signal: 'high', humanRange: '0.4-0.7' },
 *     sentenceLengthVariation: { value: 0.55, signal: 'high', humanRange: '0.3-0.6' },
 *     avgSentenceLength: { value: 17.2, signal: 'neutral', humanRange: 'varies' },
 *     punctuationVariety: { value: 0.75, signal: 'high', humanRange: '0.5-1.0' },
 *   },
 * }
 */
