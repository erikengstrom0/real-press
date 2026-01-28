'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import styles from './FilterPanel.module.css'

interface FilterPanelProps {
  currentFilter: string | null
}

export function FilterPanel({ currentFilter }: FilterPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleToggle = (filter: 'human' | 'ai' | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (filter) {
      params.set('filter', filter)
    } else {
      params.delete('filter')
    }

    // Reset to page 1 when filter changes
    params.delete('page')

    router.push(`/search?${params.toString()}`)
  }

  const isHumanActive = currentFilter === 'human'
  const isAiActive = currentFilter === 'ai'

  return (
    <div className={styles.container}>
      <span className={styles.label}>Show:</span>
      <div className={styles.toggleGroup}>
        <button
          onClick={() => handleToggle(null)}
          className={`${styles.toggleButton} ${!currentFilter ? styles.active : ''}`}
        >
          All
        </button>
        <button
          onClick={() => handleToggle('human')}
          className={`${styles.toggleButton} ${styles.humanButton} ${isHumanActive ? styles.activeHuman : ''}`}
        >
          <span className={`${styles.dot} ${styles.humanDot}`} />
          Human
        </button>
        <button
          onClick={() => handleToggle('ai')}
          className={`${styles.toggleButton} ${styles.aiButton} ${isAiActive ? styles.activeAi : ''}`}
        >
          <span className={`${styles.dot} ${styles.aiDot}`} />
          AI Generated
        </button>
      </div>
    </div>
  )
}
