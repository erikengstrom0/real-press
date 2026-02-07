'use client'

import styles from './SpellSuggestion.module.css'

interface SpellSuggestionProps {
  original: string
  suggested: string
  onAccept: () => void
  onDismiss: () => void
}

export function SpellSuggestion({
  original,
  suggested,
  onAccept,
  onDismiss,
}: SpellSuggestionProps) {
  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span className={styles.label}>Did you mean: </span>
        <button className={styles.suggestion} onClick={onAccept} type="button">
          {suggested}
        </button>
        <span className={styles.label}>?</span>
      </div>
      <button
        className={styles.dismiss}
        onClick={onDismiss}
        type="button"
        aria-label="Dismiss suggestion"
      >
        &times;
      </button>
    </div>
  )
}
