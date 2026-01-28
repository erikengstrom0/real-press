'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import styles from './FilterPanel.module.css'

interface FilterPanelProps {
  currentFilter: string | null
  currentSort: string | null
}

export function FilterPanel({ currentFilter, currentSort }: FilterPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    // Reset to page 1 when filter/sort changes
    params.delete('page')

    router.push(`/search?${params.toString()}`)
  }

  const isHumanFilterOn = currentFilter === 'human'
  const isSortByScore = currentSort === 'score'

  const toggleHumanFilter = () => {
    updateParams('filter', isHumanFilterOn ? null : 'human')
  }

  const toggleSort = () => {
    updateParams('sort', isSortByScore ? null : 'score')
  }

  return (
    <div className={styles.container}>
      <div className={styles.control}>
        <span className={styles.label}>Human Only</span>
        <button
          onClick={toggleHumanFilter}
          className={`${styles.toggle} ${isHumanFilterOn ? styles.toggleOn : styles.toggleOff}`}
          role="switch"
          aria-checked={isHumanFilterOn}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.control}>
        <span className={styles.label}>Sort by Score</span>
        <button
          onClick={toggleSort}
          className={`${styles.toggle} ${isSortByScore ? styles.toggleOn : styles.toggleOff}`}
          role="switch"
          aria-checked={isSortByScore}
        >
          <span className={styles.toggleKnob} />
        </button>
      </div>
    </div>
  )
}
