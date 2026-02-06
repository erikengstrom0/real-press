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
 * Extract text between XML tags using regex (Node.js compatible)
 */
function extractTag(xml: string, tag: string): string {
  // Handle namespaced tags like dc:creator
  const tagPattern = tag.replace(':', '\\:')
  const regex = new RegExp(`<${tagPattern}[^>]*>([\\s\\S]*?)<\\/${tagPattern}>`, 'i')
  const match = xml.match(regex)
  // Strip CDATA wrappers if present
  const content = match?.[1]?.trim() || ''
  return content.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim()
}

/**
 * Extract href attribute from link tag
 */
function extractLinkHref(xml: string): string {
  // Try alternate link first
  const altMatch = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
  if (altMatch) return altMatch[1]

  // Try any link with href
  const hrefMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i)
  if (hrefMatch) return hrefMatch[1]

  // Try link content
  const contentMatch = xml.match(/<link[^>]*>([^<]+)<\/link>/i)
  if (contentMatch) return contentMatch[1].trim()

  return ''
}

/**
 * Parse RSS 2.0 feed using regex (Node.js compatible)
 */
function parseRSS2(xml: string, feedUrl: string): RSSFeed {
  const items: RSSItem[] = []

  // Extract items
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let itemMatch
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1]
    items.push({
      title: extractTag(itemXml, 'title'),
      link: extractTag(itemXml, 'link') || extractLinkHref(itemXml),
      description: extractTag(itemXml, 'description'),
      pubDate: extractTag(itemXml, 'pubDate'),
      author: extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator') || undefined,
      categories: [],
      guid: extractTag(itemXml, 'guid'),
      content: extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'description'),
    })
  }

  // Extract channel info
  const channelMatch = xml.match(/<channel>([\s\S]*?)<item>/i)
  const channelXml = channelMatch?.[1] || xml

  return {
    title: extractTag(channelXml, 'title'),
    link: extractTag(channelXml, 'link') || feedUrl,
    description: extractTag(channelXml, 'description'),
    language: extractTag(channelXml, 'language') || undefined,
    lastBuildDate: extractTag(channelXml, 'lastBuildDate') || undefined,
    items,
  }
}

/**
 * Parse Atom feed using regex (Node.js compatible)
 */
function parseAtom(xml: string, feedUrl: string): RSSFeed {
  const items: RSSItem[] = []

  // Extract entries
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
  let entryMatch
  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entryXml = entryMatch[1]
    items.push({
      title: extractTag(entryXml, 'title'),
      link: extractLinkHref(entryXml),
      description: extractTag(entryXml, 'summary') || extractTag(entryXml, 'content'),
      pubDate: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated'),
      author: extractTag(entryXml, 'name'), // Inside <author>
      categories: [],
      guid: extractTag(entryXml, 'id'),
      content: extractTag(entryXml, 'content'),
    })
  }

  return {
    title: extractTag(xml, 'title'),
    link: extractLinkHref(xml) || feedUrl,
    description: extractTag(xml, 'subtitle'),
    language: undefined,
    lastBuildDate: extractTag(xml, 'updated') || undefined,
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

  // Detect feed type and parse accordingly (regex-based, Node.js compatible)
  if (xml.includes('<feed') && xml.includes('<entry')) {
    return parseAtom(xml, feedUrl)
  } else if (xml.includes('<rss') || xml.includes('<channel>')) {
    return parseRSS2(xml, feedUrl)
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
