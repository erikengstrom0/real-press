'use client'

import styles from './FilterPanel.module.css'

interface FilterPanelProps {
  currentFilter: string | null
  currentSort: string | null
  onFilterChange: (filter: string | null) => void
  onSortChange: (sort: string | null) => void
}

export function FilterPanel({ currentFilter, currentSort, onFilterChange, onSortChange }: FilterPanelProps) {
  const isHumanFilterOn = currentFilter === 'human'
  const isSortByScore = currentSort === 'score'

  const toggleHumanFilter = () => {
    onFilterChange(isHumanFilterOn ? null : 'human')
  }

  const toggleSort = () => {
    onSortChange(isSortByScore ? null : 'score')
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
