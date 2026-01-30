'use client'

import type { Classification } from '@/lib/ai-detection'
import { getStampStyles, getStampClass, getStampLabel } from '@/lib/utils/stamp-variations'
import { useMemo } from 'react'

interface AIScoreBadgeProps {
  score: number // Internal score: 0 = human, 1 = AI
  classification: Classification
  showScore?: boolean
  size?: 'small' | 'medium' | 'large'
}

export function AIScoreBadge({
  score,
  classification,
  showScore = false,
  size = 'medium',
}: AIScoreBadgeProps) {
  // Generate random stamp variations once per mount
  const stampStyles = useMemo(() => getStampStyles(), [])

  // Invert score for display: 100% = human, 0% = AI
  const humanPercentage = Math.round((1 - score) * 100)

  // Get the appropriate stamp class and label
  const stampClass = getStampClass(classification)
  const label = getStampLabel(classification)

  // Map size to stamp size class
  const sizeClass = size === 'small' ? 'stamp-sm' : size === 'large' ? 'stamp-lg' : ''

  return (
    <span
      className={`stamp ${stampClass} ${sizeClass} stamp-uneven`}
      style={stampStyles}
      title={`Human Score: ${humanPercentage}%`}
    >
      <span>{label}</span>
      {showScore && <span style={{ marginLeft: '0.5em' }}>{humanPercentage}%</span>}
    </span>
  )
}

export function AIScoreBadgeSkeleton({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  const sizeClass = size === 'small' ? 'stamp-sm' : size === 'large' ? 'stamp-lg' : ''

  return (
    <span
      className={`stamp stamp-unsure ${sizeClass}`}
      style={{ opacity: 0.5 }}
    >
      Loading...
    </span>
  )
}
