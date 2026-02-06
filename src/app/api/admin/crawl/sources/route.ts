import { NextRequest, NextResponse } from 'next/server'
import { createCrawlJobsBatch } from '@/lib/services/crawl-job.service'
import * as HackerNews from '@/lib/sources/hackernews.source'
import * as DevTo from '@/lib/sources/devto.source'
import * as RSS from '@/lib/sources/rss.source'

type SourceType = 'hackernews' | 'devto' | 'rss' | 'all'

interface ImportResult {
  source: string
  urls: number
  created: number
  duplicates: number
  error?: string
}

/**
 * GET /api/admin/crawl/sources
 * List available content sources
 */
export async function GET() {
  return NextResponse.json({
    sources: [
      {
        id: 'hackernews',
        name: 'Hacker News',
        description: 'Top/best stories with external links',
        options: { type: ['top', 'best', 'new'], limit: 50, minScore: 10 },
      },
      {
        id: 'devto',
        name: 'DEV.to',
        description: 'Rising/top developer articles',
        options: { type: ['rising', 'top', 'latest'], limit: 50, minReactions: 5 },
      },
      {
        id: 'rss',
        name: 'RSS Feeds',
        description: 'Curated tech blogs and newsletters',
        feeds: Object.keys(RSS.CURATED_FEEDS),
      },
    ],
  })
}

/**
 * POST /api/admin/crawl/sources
 * Import URLs from content sources into crawl queue
 *
 * Body:
 * - source: 'hackernews' | 'devto' | 'rss' | 'all'
 * - options: source-specific options
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source, options = {} } = body as {
      source: SourceType
      options?: Record<string, unknown>
    }

    if (!source) {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }

    const results: ImportResult[] = []

    // Import from Hacker News
    if (source === 'hackernews' || source === 'all') {
      try {
        const hnOptions = {
          type: (options.hnType as 'top' | 'best' | 'new') || 'top',
          limit: (options.hnLimit as number) || 30,
          minScore: (options.hnMinScore as number) || 10,
        }

        console.log(`[Sources] Fetching Hacker News ${hnOptions.type} stories...`)
        const hnUrls = await HackerNews.getUrlsForCrawling(hnOptions)

        if (hnUrls.length > 0) {
          const result = await createCrawlJobsBatch(
            hnUrls.map((u) => u.url),
            'source:hackernews',
            5 // Higher priority for HN
          )

          results.push({
            source: 'hackernews',
            urls: hnUrls.length,
            created: result.created,
            duplicates: result.duplicates,
          })
        } else {
          results.push({
            source: 'hackernews',
            urls: 0,
            created: 0,
            duplicates: 0,
          })
        }
      } catch (error) {
        results.push({
          source: 'hackernews',
          urls: 0,
          created: 0,
          duplicates: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Import from DEV.to
    if (source === 'devto' || source === 'all') {
      try {
        const devtoOptions = {
          type: (options.devtoType as 'rising' | 'top' | 'latest') || 'rising',
          limit: (options.devtoLimit as number) || 30,
          minReactions: (options.devtoMinReactions as number) || 5,
        }

        console.log(`[Sources] Fetching DEV.to ${devtoOptions.type} articles...`)
        const devtoUrls = await DevTo.getUrlsForCrawling(devtoOptions)

        if (devtoUrls.length > 0) {
          const result = await createCrawlJobsBatch(
            devtoUrls.map((u) => u.url),
            'source:devto',
            3 // Medium priority
          )

          results.push({
            source: 'devto',
            urls: devtoUrls.length,
            created: result.created,
            duplicates: result.duplicates,
          })
        } else {
          results.push({
            source: 'devto',
            urls: 0,
            created: 0,
            duplicates: 0,
          })
        }
      } catch (error) {
        results.push({
          source: 'devto',
          urls: 0,
          created: 0,
          duplicates: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Import from RSS feeds
    if (source === 'rss' || source === 'all') {
      try {
        const feedCategory = (options.rssFeedCategory as string) || 'tech_blogs'
        const feeds =
          RSS.CURATED_FEEDS[feedCategory as keyof typeof RSS.CURATED_FEEDS] ||
          RSS.CURATED_FEEDS.tech_blogs

        console.log(`[Sources] Fetching RSS feeds from ${feedCategory}...`)
        const rssItems = await RSS.fetchMultipleFeeds(feeds, {
          limit: (options.rssLimit as number) || 10,
          maxAge: (options.rssMaxAge as number) || 30, // Last 30 days
        })

        if (rssItems.length > 0) {
          const result = await createCrawlJobsBatch(
            rssItems.map((item) => item.url),
            `source:rss:${feedCategory}`,
            2 // Lower priority
          )

          results.push({
            source: `rss:${feedCategory}`,
            urls: rssItems.length,
            created: result.created,
            duplicates: result.duplicates,
          })
        } else {
          results.push({
            source: `rss:${feedCategory}`,
            urls: 0,
            created: 0,
            duplicates: 0,
          })
        }
      } catch (error) {
        results.push({
          source: 'rss',
          urls: 0,
          created: 0,
          duplicates: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Calculate totals
    const totals = results.reduce(
      (acc, r) => ({
        urls: acc.urls + r.urls,
        created: acc.created + r.created,
        duplicates: acc.duplicates + r.duplicates,
      }),
      { urls: 0, created: 0, duplicates: 0 }
    )

    return NextResponse.json({
      success: true,
      results,
      totals,
    })
  } catch (error) {
    console.error('Import sources error:', error)
    return NextResponse.json({ error: 'Failed to import from sources' }, { status: 500 })
  }
}
