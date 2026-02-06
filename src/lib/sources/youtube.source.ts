/**
 * YouTube Data API v3 Source Integration
 *
 * Uses the official YouTube Data API (free tier: 10,000 units/day).
 * API Docs: https://developers.google.com/youtube/v3
 *
 * Quota Costs:
 * - search.list: 100 units
 * - videos.list: 1 unit
 * - channels.list: 1 unit
 * - captions.list: 50 units
 *
 * With 10,000 units/day, you can do ~100 searches or ~10,000 video lookups.
 *
 * Cost: Free (10,000 units/day)
 * Requires: YOUTUBE_API_KEY environment variable
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

function getApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY || null
}

export function isYouTubeConfigured(): boolean {
  return getApiKey() !== null
}

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  publishedAt: string
  thumbnails: {
    default?: { url: string; width: number; height: number }
    medium?: { url: string; width: number; height: number }
    high?: { url: string; width: number; height: number }
  }
  tags?: string[]
  categoryId?: string
  liveBroadcastContent: string
  duration?: string
  viewCount?: string
  likeCount?: string
  commentCount?: string
}

export interface YouTubeChannel {
  id: string
  title: string
  description: string
  customUrl?: string
  publishedAt: string
  thumbnails: {
    default?: { url: string }
    medium?: { url: string }
    high?: { url: string }
  }
  subscriberCount?: string
  videoCount?: string
  viewCount?: string
}

export interface NormalizedVideo {
  id: string
  title: string
  description: string
  url: string
  channelName: string
  channelUrl: string
  publishedAt: Date
  thumbnailUrl: string | null
  viewCount: number
  likeCount: number
  duration: string | null
}

interface YouTubeSearchResponse {
  items: Array<{
    id: { videoId?: string; channelId?: string; playlistId?: string }
    snippet: {
      title: string
      description: string
      channelId: string
      channelTitle: string
      publishedAt: string
      thumbnails: YouTubeVideo['thumbnails']
      liveBroadcastContent: string
    }
  }>
  nextPageToken?: string
  pageInfo: { totalResults: number; resultsPerPage: number }
}

interface YouTubeVideosResponse {
  items: Array<{
    id: string
    snippet: {
      title: string
      description: string
      channelId: string
      channelTitle: string
      publishedAt: string
      thumbnails: YouTubeVideo['thumbnails']
      tags?: string[]
      categoryId?: string
      liveBroadcastContent: string
    }
    contentDetails?: {
      duration: string
    }
    statistics?: {
      viewCount: string
      likeCount: string
      commentCount: string
    }
  }>
}

/**
 * Search for videos (costs 100 quota units per call)
 */
export async function searchVideos(options: {
  query: string
  maxResults?: number
  order?: 'date' | 'rating' | 'relevance' | 'title' | 'viewCount'
  publishedAfter?: Date
  pageToken?: string
}): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string }> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('YouTube API key not configured')
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    key: apiKey,
    q: options.query,
    maxResults: String(options.maxResults || 25),
    order: options.order || 'relevance',
  })

  if (options.publishedAfter) {
    params.set('publishedAfter', options.publishedAfter.toISOString())
  }
  if (options.pageToken) {
    params.set('pageToken', options.pageToken)
  }

  const response = await fetch(`${YOUTUBE_API_BASE}/search?${params}`)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`YouTube API error: ${response.status} - ${error}`)
  }

  const data: YouTubeSearchResponse = await response.json()

  const videos: YouTubeVideo[] = data.items
    .filter((item) => item.id.videoId)
    .map((item) => ({
      id: item.id.videoId!,
      title: item.snippet.title,
      description: item.snippet.description,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnails: item.snippet.thumbnails,
      liveBroadcastContent: item.snippet.liveBroadcastContent,
    }))

  return { videos, nextPageToken: data.nextPageToken }
}

/**
 * Get video details by IDs (costs 1 quota unit per call, up to 50 videos)
 */
export async function getVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('YouTube API key not configured')
  }

  if (videoIds.length === 0) return []
  if (videoIds.length > 50) {
    throw new Error('Maximum 50 video IDs per request')
  }

  const params = new URLSearchParams({
    part: 'snippet,contentDetails,statistics',
    key: apiKey,
    id: videoIds.join(','),
  })

  const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`YouTube API error: ${response.status} - ${error}`)
  }

  const data: YouTubeVideosResponse = await response.json()

  return data.items.map((item) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnails: item.snippet.thumbnails,
    tags: item.snippet.tags,
    categoryId: item.snippet.categoryId,
    liveBroadcastContent: item.snippet.liveBroadcastContent,
    duration: item.contentDetails?.duration,
    viewCount: item.statistics?.viewCount,
    likeCount: item.statistics?.likeCount,
    commentCount: item.statistics?.commentCount,
  }))
}

/**
 * Parse ISO 8601 duration to human-readable format
 */
export function parseDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return isoDuration

  const hours = match[1] ? parseInt(match[1]) : 0
  const minutes = match[2] ? parseInt(match[2]) : 0
  const seconds = match[3] ? parseInt(match[3]) : 0

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Normalize video to common format
 */
function normalizeVideo(video: YouTubeVideo): NormalizedVideo {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    channelName: video.channelTitle,
    channelUrl: `https://www.youtube.com/channel/${video.channelId}`,
    publishedAt: new Date(video.publishedAt),
    thumbnailUrl: video.thumbnails.high?.url || video.thumbnails.medium?.url || null,
    viewCount: video.viewCount ? parseInt(video.viewCount) : 0,
    likeCount: video.likeCount ? parseInt(video.likeCount) : 0,
    duration: video.duration ? parseDuration(video.duration) : null,
  }
}

/**
 * Search and get full video details in one call
 * Note: Uses 100 units for search + 1 unit for details = 101 units total
 */
export async function searchVideosWithDetails(options: {
  query: string
  maxResults?: number
  order?: 'date' | 'rating' | 'relevance' | 'viewCount'
}): Promise<NormalizedVideo[]> {
  const { videos } = await searchVideos(options)

  if (videos.length === 0) return []

  const videoIds = videos.map((v) => v.id)
  const detailedVideos = await getVideoDetails(videoIds)

  return detailedVideos.map(normalizeVideo)
}

/**
 * Get URLs from YouTube search for crawl job creation
 * Note: YouTube videos are typically analyzed via video detection, not text extraction
 */
export async function getUrlsForCrawling(
  options: {
    query: string
    limit?: number
    minViews?: number
    order?: 'date' | 'rating' | 'relevance' | 'viewCount'
  } = { query: '' }
): Promise<Array<{ url: string; title: string; channelName: string; viewCount: number }>> {
  if (!options.query) {
    throw new Error('Search query is required')
  }

  const videos = await searchVideosWithDetails({
    query: options.query,
    maxResults: options.limit || 25,
    order: options.order || 'relevance',
  })

  const minViews = options.minViews || 1000

  return videos
    .filter((v) => v.viewCount >= minViews)
    .map((v) => ({
      url: v.url,
      title: v.title,
      channelName: v.channelName,
      viewCount: v.viewCount,
    }))
}

/**
 * Educational/tech channels worth monitoring for Real Press
 */
export const RECOMMENDED_CHANNELS = [
  { name: 'Fireship', id: 'UCsBjURrPoezykLs9EqgamOA' },
  { name: 'Traversy Media', id: 'UC29ju8bIPH5as8OGnQzwJyA' },
  { name: 'The Coding Train', id: 'UCvjgXvBlndQRgkVjTNkJ4RQ' },
  { name: 'Computerphile', id: 'UC9-y-6csu5WGm29I7JiwpnA' },
  { name: 'Two Minute Papers', id: 'UCbfYPyITQ-7l4upoX8nvctg' },
  { name: '3Blue1Brown', id: 'UCYO_jab_esuFRV4b17AJtAw' },
  { name: 'Veritasium', id: 'UCHnyfMqiRRG1u-2MsSQLbXA' },
]

/**
 * Search terms for finding human-written/produced content
 */
export const SEARCH_TERMS = [
  'programming tutorial',
  'software engineering',
  'coding interview',
  'system design',
  'tech talk',
  'conference talk programming',
  'developer experience',
]
