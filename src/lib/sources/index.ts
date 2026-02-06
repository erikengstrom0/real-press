/**
 * Content Source Integrations
 *
 * This module provides integrations with various content platforms for discovering
 * human-written content to index in Real Press.
 *
 * ## Free Sources (Integrated)
 *
 * | Source | Cost | Rate Limits | Best For |
 * |--------|------|-------------|----------|
 * | Hacker News | Free | None | Tech articles, startup content |
 * | DEV.to | Free | 30 req/30s | Developer tutorials, tech blogs |
 * | YouTube | Free | 10k units/day | Video content, tech talks |
 * | RSS/Atom | Free | None | Blogs, newsletters, publications |
 *
 * ## Usage Examples
 *
 * ```typescript
 * import { HackerNews, DevTo, YouTube, RSS } from '@/lib/sources'
 *
 * // Get top HN stories with external links
 * const hnUrls = await HackerNews.getUrlsForCrawling({ type: 'top', limit: 50 })
 *
 * // Get rising DEV.to articles
 * const devtoUrls = await DevTo.getUrlsForCrawling({ type: 'rising', limit: 30 })
 *
 * // Search YouTube for tech talks
 * const ytUrls = await YouTube.getUrlsForCrawling({ query: 'tech conference', limit: 20 })
 *
 * // Fetch Substack newsletter
 * const substackUrls = await RSS.getUrlsFromFeed(RSS.Substack.feed('stratechery'))
 * ```
 */

// Hacker News - Completely free, no auth
export * as HackerNews from './hackernews.source'

// DEV.to (Forem) - Completely free, no auth for reading
export * as DevTo from './devto.source'

// YouTube Data API - Free tier (10k units/day), requires API key
export * as YouTube from './youtube.source'

// RSS/Atom feeds - Universal, free, no auth
export * as RSS from './rss.source'

// Re-export key functions for convenience
export { getUrlsForCrawling as getHNUrls } from './hackernews.source'
export { getUrlsForCrawling as getDevToUrls } from './devto.source'
export { getUrlsForCrawling as getYouTubeUrls } from './youtube.source'
export { getUrlsFromFeed, fetchMultipleFeeds, CURATED_FEEDS } from './rss.source'
