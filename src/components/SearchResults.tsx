import type { SearchResult, SearchResponse } from '@/app/api/search/route'
import { AIScoreBadge } from './AIScoreBadge'
import styles from './SearchResults.module.css'

interface SearchResultsProps {
  results: SearchResult[]
  query: string
  total: number
  page: number
  hasMore: boolean
  onPageChange?: (page: number) => void
  filter?: string | null
  sort?: string | null
}

export function SearchResults({ results, query, total, page, hasMore, onPageChange, filter, sort }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No results found for &ldquo;{query}&rdquo;</p>
        <p className={styles.emptyHint}>
          Try different keywords or <a href="/submit">submit a URL</a> to add content.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.results}>
      <p className={styles.count}>
        {total} result{total !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
        {total > results.length && ` (showing ${(page - 1) * 10 + 1}-${(page - 1) * 10 + results.length})`}
      </p>
      <ul className={styles.list}>
        {results.map((result) => (
          <li key={result.id} className={styles.item}>
            <div className={styles.header}>
              <a
                href={result.url}
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <h3 className={styles.title}>{result.title}</h3>
              </a>
              {result.aiScore && (
                <AIScoreBadge
                  score={result.aiScore.score}
                  classification={result.aiScore.classification}
                  showScore
                  size="medium"
                />
              )}
            </div>
            <p className={styles.url}>{result.domain}</p>
            {result.description && (
              <p className={styles.description}>{result.description}</p>
            )}
            <a href={`/content/${result.id}`} className={styles.analysisLink}>
              View Analysis →
            </a>
          </li>
        ))}
      </ul>

      {(hasMore || page > 1) && (
        <Pagination
          page={page}
          hasMore={hasMore}
          query={query}
          onPageChange={onPageChange}
          filter={filter}
          sort={sort}
        />
      )}
    </div>
  )
}

function Pagination({
  page,
  hasMore,
  query,
  onPageChange,
  filter,
  sort,
}: {
  page: number
  hasMore: boolean
  query: string
  onPageChange?: (page: number) => void
  filter?: string | null
  sort?: string | null
}) {
  // Build URL with current filter/sort state
  const buildUrl = (targetPage: number) => {
    const params = new URLSearchParams({ q: query, page: String(targetPage) })
    if (filter) params.set('filter', filter)
    if (sort) params.set('sort', sort)
    return `/search?${params.toString()}`
  }

  const handlePrev = (e: React.MouseEvent) => {
    if (onPageChange && page > 1) {
      e.preventDefault()
      onPageChange(page - 1)
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    if (onPageChange && hasMore) {
      e.preventDefault()
      onPageChange(page + 1)
    }
  }

  const prevUrl = page > 1 ? buildUrl(page - 1) : null
  const nextUrl = hasMore ? buildUrl(page + 1) : null

  return (
    <div className={styles.pagination}>
      {prevUrl ? (
        <a href={prevUrl} className={styles.pageLink} onClick={handlePrev}>
          ← Previous
        </a>
      ) : (
        <span className={styles.pageLinkDisabled}>← Previous</span>
      )}
      <span className={styles.pageNumber}>Page {page}</span>
      {nextUrl ? (
        <a href={nextUrl} className={styles.pageLink} onClick={handleNext}>
          Next →
        </a>
      ) : (
        <span className={styles.pageLinkDisabled}>Next →</span>
      )}
    </div>
  )
}

// Re-export types for convenience
export type { SearchResult, SearchResponse }
