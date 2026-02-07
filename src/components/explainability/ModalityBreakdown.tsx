'use client'

import styles from './ModalityBreakdown.module.css'

/* ── Local type definitions ── */

interface FusionWeight {
  type: string
  baseWeight: number
  effectiveWeight: number
  contribution: string
  score: number
}

interface ModalityBreakdownProps {
  weights: FusionWeight[]
}

/* ── Helpers ── */

function scoreToColor(score: number): string {
  if (score < 0.15) return 'var(--color-human)'
  if (score < 0.35) return 'var(--color-likely-human)'
  if (score < 0.65) return 'var(--color-unsure)'
  if (score < 0.85) return 'var(--color-likely-ai)'
  return 'var(--color-ai)'
}

function parseContribution(contribution: string): number {
  return parseFloat(contribution.replace('%', '')) || 100
}

/* ── Component ── */

export function ModalityBreakdown({ weights }: ModalityBreakdownProps) {
  const isSingleModality = weights.length === 1

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>Score Breakdown</h4>

      <div className={styles.barContainer}>
        {weights.map((weight) => {
          const pct = isSingleModality ? 100 : parseContribution(weight.contribution)
          return (
            <div
              key={weight.type}
              className={styles.segment}
              style={{
                width: `${pct}%`,
                backgroundColor: scoreToColor(weight.score),
              }}
            >
              {pct >= 15 && (
                <span className={styles.segmentLabel}>
                  {weight.type}: {weight.contribution}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Segment labels shown below the bar for narrow segments */}
      {!isSingleModality && (
        <div className={styles.segmentLabelsBelow}>
          {weights.map((weight) => {
            const pct = parseContribution(weight.contribution)
            if (pct >= 15) return null
            return (
              <span key={weight.type} className={styles.smallSegmentLabel}>
                {weight.type}: {weight.contribution}
              </span>
            )
          })}
        </div>
      )}

      <ul className={styles.legend}>
        {weights.map((weight) => (
          <li key={weight.type} className={styles.legendItem}>
            <span
              className={styles.legendSwatch}
              style={{ backgroundColor: scoreToColor(weight.score) }}
            />
            <span className={styles.legendType}>{weight.type}</span>
            <span className={styles.legendScore}>
              {Math.round((1 - weight.score) * 100)}% Human
            </span>
            {!isSingleModality && (
              <span className={styles.legendContribution}>
                {weight.contribution}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/*
 * Example mock props (multi-modal):
 * {
 *   weights: [
 *     { type: 'text', baseWeight: 0.50, effectiveWeight: 0.455, contribution: '62%', score: 0.15 },
 *     { type: 'image', baseWeight: 0.35, effectiveWeight: 0.280, contribution: '38%', score: 0.14 },
 *   ],
 * }
 *
 * Example mock props (text-only):
 * {
 *   weights: [
 *     { type: 'text', baseWeight: 1.0, effectiveWeight: 1.0, contribution: '100%', score: 0.22 },
 *   ],
 * }
 */
