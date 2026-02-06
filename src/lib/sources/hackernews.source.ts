/**
 * Hacker News Source Integration
 *
 * Uses the official Hacker News Firebase API (completely free, no auth required).
 * API Docs: https://github.com/HackerNews/API
 *
 * Rate Limits: None officially enforced, but be respectful (15-30s poll intervals)
 * Cost: Free
 */

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0'

export interface HNItem {
  id: number
  type: 'story' | 'comment' | 'job' | 'poll' | 'pollopt'
  by?: string
  time: number
  text?: string
  dead?: boolean
  deleted?: boolean
  parent?: number
  poll?: number
  kids?: number[]
  url?: string
  score?: number
  title?: string
  parts?: number[]
  descendants?: number
}

export interface HNStory {
  id: number
  title: string
  url: string | null
  text: string | null
  author: string
  score: number
  commentCount: number
  createdAt: Date
  hnUrl: string
}

/**
 * Fetch a single item by ID
 */
export async function fetchItem(id: number): Promise<HNItem | null> {
  try {
    const response = await fetch(`${HN_API_BASE}/item/${id}.json`)
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

/**
 * Fetch top story IDs
 * Returns up to 500 story IDs
 */
export async function fetchTopStoryIds(): Promise<number[]> {
  const response = await fetch(`${HN_API_BASE}/topstories.json`)
  if (!response.ok) throw new Error('Failed to fetch top stories')
  return response.json()
}

/**
 * Fetch new story IDs
 * Returns up to 500 newest story IDs
 */
export async function fetchNewStoryIds(): Promise<number[]> {
  const response = await fetch(`${HN_API_BASE}/newstories.json`)
  if (!response.ok) throw new Error('Failed to fetch new stories')
  return response.json()
}

/**
 * Fetch best story IDs
 * Returns up to 500 best story IDs
 */
export async function fetchBestStoryIds(): Promise<number[]> {
  const response = await fetch(`${HN_API_BASE}/beststories.json`)
  if (!response.ok) throw new Error('Failed to fetch best stories')
  return response.json()
}

/**
 * Fetch ask HN story IDs
 */
export async function fetchAskStoryIds(): Promise<number[]> {
  const response = await fetch(`${HN_API_BASE}/askstories.json`)
  if (!response.ok) throw new Error('Failed to fetch ask stories')
  return response.json()
}

/**
 * Fetch show HN story IDs
 */
export async function fetchShowStoryIds(): Promise<number[]> {
  const response = await fetch(`${HN_API_BASE}/showstories.json`)
  if (!response.ok) throw new Error('Failed to fetch show stories')
  return response.json()
}

/**
 * Convert raw HN item to normalized story format
 */
function normalizeStory(item: HNItem): HNStory | null {
  if (item.type !== 'story' || item.deleted || item.dead) {
    return null
  }

  // Skip if no URL and no text (Ask HN without content)
  if (!item.url && !item.text) {
    return null
  }

  return {
    id: item.id,
    title: item.title || '',
    url: item.url || null,
    text: item.text || null,
    author: item.by || 'unknown',
    score: item.score || 0,
    commentCount: item.descendants || 0,
    createdAt: new Date(item.time * 1000),
    hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
  }
}

/**
 * Fetch multiple stories by IDs with concurrency control
 */
export async function fetchStories(
  ids: number[],
  options: { limit?: number; concurrency?: number } = {}
): Promise<HNStory[]> {
  const { limit = 30, concurrency = 5 } = options
  const limitedIds = ids.slice(0, limit)

  const stories: HNStory[] = []
  const chunks: number[][] = []

  // Split into chunks for concurrent fetching
  for (let i = 0; i < limitedIds.length; i += concurrency) {
    chunks.push(limitedIds.slice(i, i + concurrency))
  }

  for (const chunk of chunks) {
    const items = await Promise.all(chunk.map(fetchItem))

    for (const item of items) {
      if (item) {
        const story = normalizeStory(item)
        if (story) {
          stories.push(story)
        }
      }
    }
  }

  return stories
}

/**
 * Get top stories with full details
 */
export async function getTopStories(limit = 30): Promise<HNStory[]> {
  const ids = await fetchTopStoryIds()
  return fetchStories(ids, { limit })
}

/**
 * Get new stories with full details
 */
export async function getNewStories(limit = 30): Promise<HNStory[]> {
  const ids = await fetchNewStoryIds()
  return fetchStories(ids, { limit })
}

/**
 * Get best stories with full details
 */
export async function getBestStories(limit = 30): Promise<HNStory[]> {
  const ids = await fetchBestStoryIds()
  return fetchStories(ids, { limit })
}

/**
 * Get stories with external URLs only (filter out Ask HN, Show HN text-only posts)
 * These are the best candidates for Real Press indexing
 */
export async function getExternalLinkStories(
  type: 'top' | 'new' | 'best' = 'top',
  limit = 30
): Promise<HNStory[]> {
  let ids: number[]

  switch (type) {
    case 'new':
      ids = await fetchNewStoryIds()
      break
    case 'best':
      ids = await fetchBestStoryIds()
      break
    default:
      ids = await fetchTopStoryIds()
  }

  // Fetch more than limit since some won't have external URLs
  const stories = await fetchStories(ids, { limit: limit * 2 })

  // Filter to only stories with external URLs
  return stories.filter((s) => s.url !== null).slice(0, limit)
}

/**
 * Get URLs from top HN stories for crawl job creation
 * Returns unique URLs suitable for adding to the crawl queue
 */
export async function getUrlsForCrawling(
  options: { type?: 'top' | 'new' | 'best'; limit?: number; minScore?: number } = {}
): Promise<Array<{ url: string; title: string; hnScore: number; hnUrl: string }>> {
  const { type = 'top', limit = 50, minScore = 10 } = options

  const stories = await getExternalLinkStories(type, limit * 2)

  return stories
    .filter((s) => s.url && s.score >= minScore)
    .slice(0, limit)
    .map((s) => ({
      url: s.url!,
      title: s.title,
      hnScore: s.score,
      hnUrl: s.hnUrl,
    }))
}
