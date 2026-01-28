'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { Classification } from '@/lib/ai-detection'
import styles from './FilterPanel.module.css'

interface FilterOption {
  value: string | null
  label: string
  color?: string
}

const filterOptions: FilterOption[] = [
  { value: null, label: 'All Results' },
  { value: 'human', label: 'Human', color: '#166534' },
  { value: 'likely_human', label: 'Likely Human', color: '#3f6212' },
  { value: 'unsure', label: 'Unsure', color: '#854d0e' },
  { value: 'likely_ai', label: 'Likely AI', color: '#9a3412' },
  { value: 'ai', label: 'AI Generated', color: '#991b1b' },
]

interface FilterPanelProps {
  currentFilter: Classification | null
}

export function FilterPanel({ currentFilter }: FilterPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleFilterChange = (filter: string | null) => {
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

  return (
    <div className={styles.container}>
      <span className={styles.label}>Filter:</span>
      <div className={styles.options}>
        {filterOptions.map((option) => {
          const isActive = currentFilter === option.value
          return (
            <button
              key={option.value || 'all'}
              onClick={() => handleFilterChange(option.value)}
              className={`${styles.option} ${isActive ? styles.active : ''}`}
              style={
                isActive && option.color
                  ? { borderColor: option.color, color: option.color }
                  : undefined
              }
            >
              {option.color && (
                <span
                  className={styles.dot}
                  style={{ backgroundColor: option.color }}
                />
              )}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
