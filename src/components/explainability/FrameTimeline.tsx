'use client'

import styles from './FrameTimeline.module.css'

/* ── Local type definitions ── */

interface FrameData {
  index: number
  timestamp?: number
  score: number
  confidence: number
}

interface FrameTimelineProps {
  frames: FrameData[]
  variancePenalty?: number
}

/* ── Layout constants ── */

const CHART_W = 530
const CHART_H = 180
const PAD_L = 50
const PAD_T = 20
const PAD_B = 35
const TOTAL_W = PAD_L + CHART_W + 30
const TOTAL_H = PAD_T + CHART_H + PAD_B

/* ── Component ── */

export function FrameTimeline({ frames, variancePenalty }: FrameTimelineProps) {
  if (frames.length === 0) return null

  const useTimestamp = frames.some((f) => f.timestamp !== undefined)

  const xScale = (i: number) => {
    if (frames.length === 1) return PAD_L + CHART_W / 2
    return PAD_L + (i / (frames.length - 1)) * CHART_W
  }

  const yScale = (score: number) => PAD_T + (1 - score) * CHART_H

  /* Line path */
  const linePath = frames
    .map((f, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(f.score)}`)
    .join(' ')

  /* Filled area under the line */
  const fillPath = `${linePath} L ${xScale(frames.length - 1)} ${yScale(0)} L ${xScale(0)} ${yScale(0)} Z`

  const y035 = yScale(0.35)
  const y065 = yScale(0.65)

  /* Determine which x-labels to show */
  const labelInterval =
    frames.length > 10 ? Math.ceil(frames.length / 8) : 1

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>Video Frame Timeline</h4>

      <div className={styles.chartWrapper}>
        <svg
          viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
          className={styles.chart}
          role="img"
          aria-label="Video frame AI probability timeline"
        >
          <defs>
            <linearGradient id="frameAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A65D5D" stopOpacity="0.3" />
              <stop offset="35%" stopColor="#A65D5D" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#8B8680" stopOpacity="0.1" />
              <stop offset="65%" stopColor="#249445" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#249445" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Y-axis grid + labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={`y-${v}`}>
              <text
                x={PAD_L - 8}
                y={yScale(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className={styles.axisText}
              >
                {v.toFixed(2)}
              </text>
              <line
                x1={PAD_L}
                y1={yScale(v)}
                x2={PAD_L + CHART_W}
                y2={yScale(v)}
                stroke="#6B665E"
                strokeWidth={0.5}
                strokeDasharray="2,3"
                opacity={0.3}
              />
            </g>
          ))}

          {/* Threshold lines */}
          <line
            x1={PAD_L} y1={y035}
            x2={PAD_L + CHART_W} y2={y035}
            stroke="#249445" strokeWidth={1}
            strokeDasharray="6,4" opacity={0.6}
          />
          <text
            x={PAD_L + CHART_W + 4} y={y035}
            dominantBaseline="middle"
            className={styles.thresholdLabel}
          >
            0.35
          </text>

          <line
            x1={PAD_L} y1={y065}
            x2={PAD_L + CHART_W} y2={y065}
            stroke="#A65D5D" strokeWidth={1}
            strokeDasharray="6,4" opacity={0.6}
          />
          <text
            x={PAD_L + CHART_W + 4} y={y065}
            dominantBaseline="middle"
            className={styles.thresholdLabel}
          >
            0.65
          </text>

          {/* Zone labels */}
          <text x={PAD_L + 4} y={yScale(0.175)} className={styles.zoneLabel}>
            Likely Human
          </text>
          <text x={PAD_L + 4} y={yScale(0.825)} className={styles.zoneLabel}>
            Likely AI
          </text>

          {/* Filled area under line */}
          <path d={fillPath} fill="url(#frameAreaGrad)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#2D2A26"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Data points */}
          {frames.map((f, i) => (
            <circle
              key={`pt-${i}`}
              cx={xScale(i)}
              cy={yScale(f.score)}
              r={3}
              fill="#2D2A26"
              stroke="#FAF8F5"
              strokeWidth={1.5}
            />
          ))}

          {/* X-axis labels */}
          {frames.map((f, i) => {
            if (i % labelInterval !== 0 && i !== frames.length - 1) return null
            const label =
              useTimestamp && f.timestamp !== undefined
                ? `${Math.round(f.timestamp)}s`
                : `${f.index}`
            return (
              <text
                key={`xl-${i}`}
                x={xScale(i)}
                y={PAD_T + CHART_H + 16}
                textAnchor="middle"
                className={styles.axisText}
              >
                {label}
              </text>
            )
          })}

          {/* Axes */}
          <line
            x1={PAD_L} y1={PAD_T}
            x2={PAD_L} y2={PAD_T + CHART_H}
            stroke="#2D2A26" strokeWidth={1}
          />
          <line
            x1={PAD_L} y1={PAD_T + CHART_H}
            x2={PAD_L + CHART_W} y2={PAD_T + CHART_H}
            stroke="#2D2A26" strokeWidth={1}
          />
        </svg>
      </div>

      {variancePenalty !== undefined && (
        <p className={styles.varianceNote}>
          Frame agreement: {Math.round((1 - variancePenalty) * 100)}% consistency
        </p>
      )}
    </div>
  )
}

/*
 * Example mock props:
 * {
 *   frames: [
 *     { index: 0, timestamp: 0, score: 0.12, confidence: 0.85 },
 *     { index: 1, timestamp: 2, score: 0.15, confidence: 0.82 },
 *     { index: 2, timestamp: 4, score: 0.11, confidence: 0.88 },
 *     { index: 3, timestamp: 6, score: 0.18, confidence: 0.80 },
 *     { index: 4, timestamp: 8, score: 0.14, confidence: 0.84 },
 *   ],
 *   variancePenalty: 0.05,
 * }
 */
