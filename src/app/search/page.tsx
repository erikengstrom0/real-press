import { SearchBar } from '@/components/SearchBar'
import { SearchResultsContainer } from '@/components/SearchResultsContainer'
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

  const params = new URLSearchParams({ q: query })
  if (filter) params.set('filter', filter)
  if (sort) params.set('sort', sort)
  if (page) params.set('page', page)

  // Use absolute URL for server-side fetch (required in Next.js server components)
  // Prefer NEXT_PUBLIC_APP_URL (custom domain) over VERCEL_URL (deployment URL)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

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
        <SearchBar key={query} defaultValue={query} />
      </header>

      <section className={styles.content}>
        {query ? (
          <SearchResultsContainer
            key={query}
            initialResults={searchResponse.results}
            query={query}
            initialTotal={searchResponse.total}
            initialPage={searchResponse.page}
            initialHasMore={searchResponse.hasMore}
            initialFilter={filter}
            initialSort={sort}
          />
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
