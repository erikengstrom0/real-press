'use client'

import styles from './SpellSuggestion.module.css'

interface SpellSuggestionProps {
  original: string
  suggested: string
  onSearchOriginal: () => void
  onSearchSuggested: () => void
}

export function SpellSuggestion({
  original,
  suggested,
  onSearchOriginal,
  onSearchSuggested,
}: SpellSuggestionProps) {
  return (
    <div className={styles.banner}>
      <div className={styles.row}>
        <span className={styles.label}>Did you mean: </span>
        <button className={styles.suggested} onClick={onSearchSuggested} type="button">
          {suggested}
        </button>
        <span className={styles.label}>?</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Or search for: </span>
        <button className={styles.original} onClick={onSearchOriginal} type="button">
          {original}
        </button>
      </div>
    </div>
  )
}
