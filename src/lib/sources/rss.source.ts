/**
 * RSS/Atom Feed Source Integration
 *
 * Universal RSS/Atom feed parser for:
 * - Medium publications and authors
 * - Substack newsletters
 * - WordPress blogs
 * - Any site with RSS/Atom feeds
 *
 * Rate Limits: None (direct feed access)
 * Cost: Free
 */

export interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string
  author?: string
  categories?: string[]
  guid?: string
  content?: string
}

export interface RSSFeed {
  title: string
  link: string
  description: string
  language?: string
  lastBuildDate?: string
  items: RSSItem[]
}

export interface NormalizedFeedItem {
  title: string
  url: string
  description: string
  publishedAt: Date
  author: string | null
  categories: string[]
  feedTitle: string
  feedUrl: string
}

/**
 * Parse XML string to DOM
 */
function parseXML(xmlString: string): Document {
  // Use browser DOMParser if available, otherwise basic regex parsing
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    return parser.parseFromString(xmlString, 'text/xml')
  }

  // Fallback for Node.js environments - use basic parsing
  throw new Error('DOMParser not available - use server-side XML parser')
}

/**
 * Extract text content from an element
 */
function getText(element: Element | null): string {
  if (!element) return ''
  return element.textContent?.trim() || ''
}

/**
 * Parse RSS 2.0 feed
 */
function parseRSS2(doc: Document, feedUrl: string): RSSFeed {
  const channel = doc.querySelector('channel')
  if (!channel) throw new Error('Invalid RSS feed: no channel element')

  const items: RSSItem[] = []
  const itemElements = channel.querySelectorAll('item')

  itemElements.forEach((item) => {
    items.push({
      title: getText(item.querySelector('title')),
      link: getText(item.querySelector('link')),
      description: getText(item.querySelector('description')),
      pubDate: getText(item.querySelector('pubDate')),
      author:
        getText(item.querySelector('author')) ||
        getText(item.querySelector('dc\\:creator')) ||
        undefined,
      categories: Array.from(item.querySelectorAll('category')).map((c) => getText(c)),
      guid: getText(item.querySelector('guid')),
      content:
        getText(item.querySelector('content\\:encoded')) ||
        getText(item.querySelector('description')),
    })
  })

  return {
    title: getText(channel.querySelector('title')),
    link: getText(channel.querySelector('link')) || feedUrl,
    description: getText(channel.querySelector('description')),
    language: getText(channel.querySelector('language')) || undefined,
    lastBuildDate: getText(channel.querySelector('lastBuildDate')) || undefined,
    items,
  }
}

/**
 * Parse Atom feed
 */
function parseAtom(doc: Document, feedUrl: string): RSSFeed {
  const feed = doc.querySelector('feed')
  if (!feed) throw new Error('Invalid Atom feed: no feed element')

  const items: RSSItem[] = []
  const entryElements = feed.querySelectorAll('entry')

  entryElements.forEach((entry) => {
    const link =
      entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
      entry.querySelector('link')?.getAttribute('href') ||
      ''

    items.push({
      title: getText(entry.querySelector('title')),
      link,
      description:
        getText(entry.querySelector('summary')) || getText(entry.querySelector('content')),
      pubDate: getText(entry.querySelector('published')) || getText(entry.querySelector('updated')),
      author: getText(entry.querySelector('author name')),
      categories: Array.from(entry.querySelectorAll('category')).map(
        (c) => c.getAttribute('term') || getText(c)
      ),
      guid: getText(entry.querySelector('id')),
      content: getText(entry.querySelector('content')),
    })
  })

  const feedLink =
    feed.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
    feed.querySelector('link')?.getAttribute('href') ||
    feedUrl

  return {
    title: getText(feed.querySelector('title')),
    link: feedLink,
    description: getText(feed.querySelector('subtitle')),
    language: feed.getAttribute('xml:lang') || undefined,
    lastBuildDate: getText(feed.querySelector('updated')) || undefined,
    items,
  }
}

/**
 * Fetch and parse an RSS/Atom feed
 */
export async function fetchFeed(feedUrl: string): Promise<RSSFeed> {
  const response = await fetch(feedUrl, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      'User-Agent': 'RealPress/1.0 (Content Discovery)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status}`)
  }

  const xml = await response.text()
  const doc = parseXML(xml)

  // Detect feed type and parse accordingly
  if (doc.querySelector('feed')) {
    return parseAtom(doc, feedUrl)
  } else if (doc.querySelector('rss') || doc.querySelector('channel')) {
    return parseRSS2(doc, feedUrl)
  } else {
    throw new Error('Unknown feed format')
  }
}

/**
 * Normalize feed items to common format
 */
export function normalizeFeedItems(feed: RSSFeed): NormalizedFeedItem[] {
  return feed.items.map((item) => ({
    title: item.title,
    url: item.link,
    description: item.description,
    publishedAt: new Date(item.pubDate),
    author: item.author || null,
    categories: item.categories || [],
    feedTitle: feed.title,
    feedUrl: feed.link,
  }))
}

/**
 * Get URLs from RSS feed for crawl job creation
 */
export async function getUrlsFromFeed(
  feedUrl: string,
  options: { limit?: number; maxAge?: number } = {}
): Promise<Array<{ url: string; title: string; author: string | null; publishedAt: Date }>> {
  const { limit = 20, maxAge } = options

  const feed = await fetchFeed(feedUrl)
  let items = normalizeFeedItems(feed)

  // Filter by age if specified (maxAge in days)
  if (maxAge) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - maxAge)
    items = items.filter((item) => item.publishedAt >= cutoff)
  }

  return items.slice(0, limit).map((item) => ({
    url: item.url,
    title: item.title,
    author: item.author,
    publishedAt: item.publishedAt,
  }))
}

// ============================================================================
// Platform-Specific Helpers
// ============================================================================

/**
 * Medium RSS feed URL patterns
 */
export const Medium = {
  /**
   * Get feed URL for a Medium user
   * @example Medium.userFeed('dan_abramov') -> 'https://medium.com/feed/@dan_abramov'
   */
  userFeed: (username: string) => `https://medium.com/feed/@${username}`,

  /**
   * Get feed URL for a Medium publication
   * @example Medium.publicationFeed('javascript-in-plain-english')
   */
  publicationFeed: (publication: string) => `https://medium.com/feed/${publication}`,

  /**
   * Get feed URL for a Medium tag
   * @example Medium.tagFeed('programming')
   */
  tagFeed: (tag: string) => `https://medium.com/feed/tag/${tag}`,
}

/**
 * Substack RSS feed URL pattern
 */
export const Substack = {
  /**
   * Get feed URL for a Substack newsletter
   * @example Substack.feed('stratechery') -> 'https://stratechery.substack.com/feed'
   */
  feed: (newsletter: string) => `https://${newsletter}.substack.com/feed`,
}

/**
 * WordPress RSS feed URL patterns
 */
export const WordPress = {
  /**
   * Standard WordPress feed URL
   * @example WordPress.feed('https://example.com') -> 'https://example.com/feed/'
   */
  feed: (siteUrl: string) => {
    const base = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl
    return `${base}/feed/`
  },

  /**
   * WordPress category feed
   */
  categoryFeed: (siteUrl: string, category: string) => {
    const base = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl
    return `${base}/category/${category}/feed/`
  },
}

// ============================================================================
// Curated Feed Lists
// ============================================================================

/**
 * High-quality tech/writing feeds for Real Press
 */
export const CURATED_FEEDS = {
  medium: [
    Medium.userFeed('dan_abramov'),
    Medium.userFeed('ericsimons'),
    Medium.publicationFeed('javascript-in-plain-english'),
    Medium.publicationFeed('better-programming'),
    Medium.publicationFeed('towards-data-science'),
  ],
  substack: [
    Substack.feed('stratechery'),
    Substack.feed('platformer'),
    Substack.feed('thegeneralist'),
    Substack.feed('lenny'),
    Substack.feed('danco'),
  ],
  tech_blogs: [
    'https://blog.pragmaticengineer.com/rss/',
    'https://martinfowler.com/feed.atom',
    'https://www.joelonsoftware.com/feed/',
    'https://blog.codinghorror.com/rss/',
    'https://feeds.feedburner.com/HighScalability',
  ],
}

/**
 * Fetch multiple feeds and combine results
 */
export async function fetchMultipleFeeds(
  feedUrls: string[],
  options: { limit?: number; maxAge?: number } = {}
): Promise<NormalizedFeedItem[]> {
  const { limit = 10, maxAge } = options

  const results = await Promise.allSettled(
    feedUrls.map((url) =>
      fetchFeed(url).then((feed) => ({
        feed,
        url,
      }))
    )
  )

  const allItems: NormalizedFeedItem[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const items = normalizeFeedItems(result.value.feed)
      allItems.push(...items.slice(0, limit))
    }
  }

  // Sort by publish date (newest first)
  allItems.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())

  // Filter by age if specified
  if (maxAge) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - maxAge)
    return allItems.filter((item) => item.publishedAt >= cutoff)
  }

  return allItems
}
