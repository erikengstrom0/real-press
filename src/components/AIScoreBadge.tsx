import type { Classification } from '@/lib/ai-detection'
import styles from './AIScoreBadge.module.css'

interface AIScoreBadgeProps {
  score: number // Internal score: 0 = human, 1 = AI
  classification: Classification
  showScore?: boolean
  size?: 'small' | 'medium' | 'large'
}

const classificationConfig: Record<
  Classification,
  { label: string; color: string; bgColor: string }
> = {
  human: { label: 'Human', color: '#166534', bgColor: '#dcfce7' },
  likely_human: { label: 'Likely Human', color: '#3f6212', bgColor: '#ecfccb' },
  unsure: { label: 'Unsure', color: '#854d0e', bgColor: '#fef9c3' },
  likely_ai: { label: 'Likely AI', color: '#9a3412', bgColor: '#ffedd5' },
  ai: { label: 'AI Generated', color: '#991b1b', bgColor: '#fee2e2' },
}

export function AIScoreBadge({
  score,
  classification,
  showScore = false,
  size = 'medium',
}: AIScoreBadgeProps) {
  const config = classificationConfig[classification]
  // Invert score for display: 100% = human, 0% = AI
  const humanPercentage = Math.round((1 - score) * 100)

  return (
    <span
      className={`${styles.badge} ${styles[size]}`}
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
      }}
      title={`Human Score: ${humanPercentage}%`}
    >
      <span className={styles.dot} style={{ backgroundColor: config.color }} />
      <span className={styles.label}>{config.label}</span>
      {showScore && <span className={styles.score}>{humanPercentage}%</span>}
    </span>
  )
}

export function AIScoreBadgeSkeleton({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  return (
    <span className={`${styles.badge} ${styles[size]} ${styles.skeleton}`}>
      <span className={styles.dot} />
      <span className={styles.label}>Loading...</span>
    </span>
  )
}
