'use client'

import { useState } from 'react'
import styles from './ImageGrid.module.css'

/* ── Local type definitions ── */

interface ImageData {
  index: number
  url?: string
  score: number
  confidence: number
}

interface ImageGridProps {
  images: ImageData[]
}

/* ── Helpers ── */

function scoreBorderClass(score: number): string {
  if (score < 0.35) return styles.borderGreen
  if (score <= 0.65) return styles.borderYellow
  return styles.borderRed
}

/* ── Component ── */

export function ImageGrid({ images }: ImageGridProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const expandedImage =
    expandedIndex !== null
      ? images.find((i) => i.index === expandedIndex) ?? null
      : null

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>Per-Image Analysis</h4>

      <div className={styles.grid}>
        {images.map((image) => (
          <button
            key={image.index}
            className={`${styles.card} ${scoreBorderClass(image.score)}`}
            onClick={() =>
              setExpandedIndex(
                expandedIndex === image.index ? null : image.index,
              )
            }
          >
            <div className={styles.thumbnail}>
              {image.url ? (
                <img
                  src={image.url}
                  alt={`Image ${image.index + 1}`}
                  className={styles.image}
                />
              ) : (
                <div className={styles.placeholder}>
                  <span className={styles.placeholderText}>No Preview</span>
                </div>
              )}
            </div>
            <div className={styles.cardInfo}>
              <span className={styles.scoreBadge}>
                {Math.round((1 - image.score) * 100)}%
              </span>
              <span className={styles.confidenceBar}>
                <span
                  className={styles.confidenceFill}
                  style={{ width: `${Math.round(image.confidence * 100)}%` }}
                />
              </span>
            </div>
          </button>
        ))}
      </div>

      {expandedImage && (
        <div className={styles.expanded}>
          <div className={styles.expandedContent}>
            {expandedImage.url && (
              <img
                src={expandedImage.url}
                alt={`Image ${expandedImage.index + 1} expanded`}
                className={styles.expandedImage}
              />
            )}
            <div className={styles.expandedDetails}>
              <p className={styles.expandedLabel}>
                Image {expandedImage.index + 1}
              </p>
              <p className={styles.expandedScore}>
                Human Score:{' '}
                {Math.round((1 - expandedImage.score) * 100)}%
              </p>
              <p className={styles.expandedConfidence}>
                Confidence:{' '}
                {Math.round(expandedImage.confidence * 100)}%
              </p>
            </div>
            <button
              className={styles.closeButton}
              onClick={() => setExpandedIndex(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/*
 * Example mock props:
 * {
 *   images: [
 *     { index: 0, url: 'https://example.com/img1.jpg', score: 0.20, confidence: 0.82 },
 *     { index: 1, url: 'https://example.com/img2.jpg', score: 0.08, confidence: 0.90 },
 *     { index: 2, score: 0.72, confidence: 0.65 },
 *   ],
 * }
 */
