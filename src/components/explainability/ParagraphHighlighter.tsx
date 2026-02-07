'use client'

import { useState } from 'react'
import styles from './ParagraphHighlighter.module.css'

/* ── Local type definitions ── */

interface ParagraphScore {
  index: number
  score: number
}

interface ParagraphHighlighterProps {
  text: string
  paragraphScores: ParagraphScore[]
}

/* ── Helpers ── */

function scoreToBgColor(score: number): string {
  if (score < 0.35) return 'rgba(36, 148, 69, 0.1)'
  if (score <= 0.65) return 'rgba(243, 214, 83, 0.12)'
  return 'rgba(166, 93, 93, 0.12)'
}

/* ── Component ── */

export function ParagraphHighlighter({
  text,
  paragraphScores,
}: ParagraphHighlighterProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (paragraphScores.length === 0) {
    return (
      <div className={styles.container}>
        <h4 className={styles.title}>Paragraph Analysis</h4>
        <p className={styles.note}>
          Paragraph-level analysis requires GPTZero provider
        </p>
      </div>
    )
  }

  const paragraphs = text.split(/\n\n+/)

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>Paragraph Analysis</h4>

      <div className={styles.textContainer}>
        {paragraphs.map((paragraph, i) => {
          if (!paragraph.trim()) return null

          const scoreData = paragraphScores.find((ps) => ps.index === i)
          const score = scoreData?.score
          const bgColor =
            score !== undefined ? scoreToBgColor(score) : 'transparent'

          return (
            <div
              key={i}
              className={styles.paragraph}
              style={{ backgroundColor: bgColor }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <p className={styles.paragraphText}>{paragraph}</p>
              {hoveredIndex === i && score !== undefined && (
                <span className={styles.scoreLabel}>
                  {Math.round((1 - score) * 100)}% Human
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/*
 * Example mock props:
 * {
 *   text: "This is the first paragraph of the article. It contains several sentences.\n\nThe second paragraph continues with different ideas and varied length.\n\nA third paragraph wraps up the content.",
 *   paragraphScores: [
 *     { index: 0, score: 0.12 },
 *     { index: 1, score: 0.08 },
 *     { index: 2, score: 0.45 },
 *   ],
 * }
 */
