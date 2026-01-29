'use client'

import { useState, useEffect, useCallback } from 'react'
import { SearchResults, type SearchResult } from './SearchResults'
import { FilterPanel } from './FilterPanel'
import { LoadingSpinner } from './LoadingSpinner'
import styles from './SearchResultsContainer.module.css'

interface SearchResultsContainerProps {
  initialResults: SearchResult[]
  query: string
  initialTotal: number
  initialPage: number
  initialHasMore: boolean
  initialFilter: string | null
  initialSort: string | null
}

export function SearchResultsContainer({
  initialResults,
  query,
  initialTotal,
  initialPage,
  initialHasMore,
  initialFilter,
  initialSort,
}: SearchResultsContainerProps) {
  const [results, setResults] = useState(initialResults)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [filter, setFilter] = useState(initialFilter)
  const [sort, setSort] = useState(initialSort)
  const [isLoading, setIsLoading] = useState(false)

  const fetchResults = useCallback(async (newFilter: string | null, newSort: string | null, newPage: number = 1) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ q: query })
      if (newFilter) params.set('filter', newFilter)
      if (newSort) params.set('sort', newSort)
      if (newPage > 1) params.set('page', String(newPage))

      const res = await fetch(`/api/search?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results)
        setTotal(data.total)
        setPage(data.page)
        setHasMore(data.hasMore)

        // Update URL without navigation
        const url = new URL(window.location.href)
        if (newFilter) {
          url.searchParams.set('filter', newFilter)
        } else {
          url.searchParams.delete('filter')
        }
        if (newSort) {
          url.searchParams.set('sort', newSort)
        } else {
          url.searchParams.delete('sort')
        }
        url.searchParams.delete('page')
        window.history.replaceState({}, '', url.toString())
      }
    } finally {
      setIsLoading(false)
    }
  }, [query])

  const handleFilterChange = (newFilter: string | null) => {
    setFilter(newFilter)
    fetchResults(newFilter, sort)
  }

  const handleSortChange = (newSort: string | null) => {
    setSort(newSort)
    fetchResults(filter, newSort)
  }

  const handlePageChange = (newPage: number) => {
    fetchResults(filter, sort, newPage)
  }

  return (
    <div className={styles.container}>
      <FilterPanel
        currentFilter={filter}
        currentSort={sort}
        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
      />

      {isLoading ? (
        <div className={styles.loading}>
          <LoadingSpinner size="medium" message="Updating results..." />
        </div>
      ) : (
        <SearchResults
          results={results}
          query={query}
          total={total}
          page={page}
          hasMore={hasMore}
          onPageChange={handlePageChange}
          filter={filter}
          sort={sort}
        />
      )}
    </div>
  )
}
