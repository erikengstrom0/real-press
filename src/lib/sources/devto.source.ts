/**
 * DEV.to (Forem) Source Integration
 *
 * Uses the official DEV.to API (completely free, no auth required for reading).
 * API Docs: https://developers.forem.com/api/v1
 *
 * Rate Limits:
 * - 10 requests per 30 seconds (creating articles)
 * - 30 requests per 30 seconds (updating articles)
 * - Read operations: Not strictly limited but be respectful
 *
 * Cost: Free
 */

const DEVTO_API_BASE = 'https://dev.to/api'

export interface DevToArticle {
  id: number
  title: string
  description: string
  readable_publish_date: string
  slug: string
  path: string
  url: string
  comments_count: number
  public_reactions_count: number
  collection_id: number | null
  published_timestamp: string
  positive_reactions_count: number
  cover_image: string | null
  social_image: string | null
  canonical_url: string
  created_at: string
  edited_at: string | null
  crossposted_at: string | null
  published_at: string
  last_comment_at: string
  reading_time_minutes: number
  tag_list: string[]
  tags: string
  user: {
    name: string
    username: string
    twitter_username: string | null
    github_username: string | null
    user_id: number
    website_url: string | null
    profile_image: string
    profile_image_90: string
  }
  organization?: {
    name: string
    username: string
    slug: string
    profile_image: string
    profile_image_90: string
  }
  flare_tag?: {
    name: string
    bg_color_hex: string
    text_color_hex: string
  }
}

export interface DevToArticleFull extends DevToArticle {
  body_html: string
  body_markdown: string
}

export interface NormalizedArticle {
  id: number
  title: string
  description: string
  url: string
  canonicalUrl: string
  author: string
  authorUsername: string
  publishedAt: Date
  readingTimeMinutes: number
  tags: string[]
  reactionsCount: number
  commentsCount: number
  coverImage: string | null
}

/**
 * Fetch published articles with optional filters
 */
export async function fetchArticles(options: {
  page?: number
  perPage?: number
  tag?: string
  username?: string
  state?: 'fresh' | 'rising' | 'all'
  top?: number // Top articles in last N days
}): Promise<DevToArticle[]> {
  const params = new URLSearchParams()

  if (options.page) params.set('page', String(options.page))
  if (options.perPage) params.set('per_page', String(Math.min(options.perPage, 1000)))
  if (options.tag) params.set('tag', options.tag)
  if (options.username) params.set('username', options.username)
  if (options.state) params.set('state', options.state)
  if (options.top) params.set('top', String(options.top))

  const response = await fetch(`${DEVTO_API_BASE}/articles?${params}`)
  if (!response.ok) {
    throw new Error(`DEV.to API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Fetch a single article by ID (includes full body content)
 */
export async function fetchArticleById(id: number): Promise<DevToArticleFull | null> {
  try {
    const response = await fetch(`${DEVTO_API_BASE}/articles/${id}`)
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

/**
 * Fetch a single article by path (e.g., "username/article-slug")
 */
export async function fetchArticleByPath(path: string): Promise<DevToArticleFull | null> {
  try {
    const response = await fetch(`${DEVTO_API_BASE}/articles/${path}`)
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

/**
 * Fetch latest articles (most recently published)
 */
export async function fetchLatestArticles(limit = 30): Promise<DevToArticle[]> {
  return fetchArticles({ perPage: limit, state: 'fresh' })
}

/**
 * Fetch rising articles (gaining traction)
 */
export async function fetchRisingArticles(limit = 30): Promise<DevToArticle[]> {
  return fetchArticles({ perPage: limit, state: 'rising' })
}

/**
 * Fetch top articles from last N days
 */
export async function fetchTopArticles(days = 7, limit = 30): Promise<DevToArticle[]> {
  return fetchArticles({ perPage: limit, top: days })
}

/**
 * Fetch articles by tag
 */
export async function fetchArticlesByTag(tag: string, limit = 30): Promise<DevToArticle[]> {
  return fetchArticles({ perPage: limit, tag })
}

/**
 * Normalize DEV.to article to common format
 */
function normalizeArticle(article: DevToArticle): NormalizedArticle {
  return {
    id: article.id,
    title: article.title,
    description: article.description,
    url: article.url,
    canonicalUrl: article.canonical_url,
    author: article.user.name,
    authorUsername: article.user.username,
    publishedAt: new Date(article.published_at),
    readingTimeMinutes: article.reading_time_minutes,
    tags: article.tag_list,
    reactionsCount: article.positive_reactions_count,
    commentsCount: article.comments_count,
    coverImage: article.cover_image,
  }
}

/**
 * Get normalized articles for easier consumption
 */
export async function getArticles(
  options: Parameters<typeof fetchArticles>[0] = {}
): Promise<NormalizedArticle[]> {
  const articles = await fetchArticles(options)
  return articles.map(normalizeArticle)
}

/**
 * Get URLs from DEV.to articles for crawl job creation
 * Prefers canonical URLs when available (for cross-posted content)
 */
export async function getUrlsForCrawling(
  options: {
    type?: 'latest' | 'rising' | 'top'
    topDays?: number
    limit?: number
    minReactions?: number
    tags?: string[]
  } = {}
): Promise<Array<{ url: string; title: string; author: string; devtoUrl: string }>> {
  const { type = 'rising', topDays = 7, limit = 50, minReactions = 5, tags } = options

  let articles: DevToArticle[]

  if (tags && tags.length > 0) {
    // Fetch from multiple tags and dedupe
    const allArticles: DevToArticle[] = []
    for (const tag of tags.slice(0, 3)) {
      // Limit to 3 tags to avoid rate limits
      const tagArticles = await fetchArticlesByTag(tag, Math.ceil(limit / tags.length))
      allArticles.push(...tagArticles)
    }
    // Dedupe by ID
    const seen = new Set<number>()
    articles = allArticles.filter((a) => {
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })
  } else {
    switch (type) {
      case 'latest':
        articles = await fetchLatestArticles(limit * 2)
        break
      case 'top':
        articles = await fetchTopArticles(topDays, limit * 2)
        break
      default:
        articles = await fetchRisingArticles(limit * 2)
    }
  }

  return articles
    .filter((a) => a.positive_reactions_count >= minReactions)
    .slice(0, limit)
    .map((a) => ({
      // Prefer canonical URL for cross-posted content (original source)
      url: a.canonical_url !== a.url ? a.canonical_url : a.url,
      title: a.title,
      author: a.user.name,
      devtoUrl: a.url,
    }))
}

/**
 * Relevant tags for Real Press (tech, writing, productivity)
 */
export const RELEVANT_TAGS = [
  'programming',
  'webdev',
  'javascript',
  'typescript',
  'python',
  'react',
  'productivity',
  'career',
  'tutorial',
  'beginners',
  'opensource',
  'discuss',
  'writing',
  'ai',
  'machinelearning',
]
