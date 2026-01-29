import { Suspense } from 'react'
import { SearchBar } from '@/components/SearchBar'
import { SearchResults } from '@/components/SearchResults'
import { FilterPanel } from '@/components/FilterPanel'
import type { SearchResponse } from '@/app/api/search/route'
import styles from './page.module.css'

interface SearchPageProps {
  searchParams: Promise<{ q?: string; filter?: string; sort?: string; page?: string }>
}

async function getSearchResults(
  query: string,
  filter?: string,
  sort?: string,
  page?: string
): Promise<SearchResponse> {
  if (!query) {
    return {
      results: [],
      query: '',
      filter: null,
      sort: null,
      total: 0,
      page: 1,
      pageSize: 10,
      hasMore: false,
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const params = new URLSearchParams({ q: query })
  if (filter) params.set('filter', filter)
  if (sort) params.set('sort', sort)
  if (page) params.set('page', page)

  const res = await fetch(`${baseUrl}/api/search?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    return {
      results: [],
      query,
      filter: null,
      sort: null,
      total: 0,
      page: 1,
      pageSize: 10,
      hasMore: false,
    }
  }

  return res.json()
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q || ''
  const filter = params.filter || null
  const sort = params.sort || null
  const page = params.page || '1'

  const searchResponse = await getSearchResults(query, filter || undefined, sort || undefined, page)

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          Real Press
        </a>
        <p className={styles.tagline}>Search the Human Web</p>
        <SearchBar defaultValue={query} />
      </header>

      <section className={styles.content}>
        {query ? (
          <>
            <Suspense fallback={null}>
              <FilterPanel currentFilter={filter} currentSort={sort} />
            </Suspense>
            <SearchResults
              results={searchResponse.results}
              query={query}
              total={searchResponse.total}
              page={searchResponse.page}
              hasMore={searchResponse.hasMore}
            />
          </>
        ) : (
          <div className={styles.placeholder}>
            <p>Enter a search query to find human-written content.</p>
            <p className={styles.hint}>
              Each result shows an AI detection score so you can find authentic content.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
