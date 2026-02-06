/**
 * Media Extraction Service
 *
 * Extracts images and video URLs from web pages and content.
 */

import type { ImageInput, VideoInput } from '../ai-detection/types'
import { validateUrlForFetch } from '../utils/ssrf-protection'

/**
 * Result of media extraction from a URL
 */
export interface ExtractedMedia {
  images: ImageInput[]
  video: VideoInput | null
}

/**
 * Minimum image dimensions to consider for analysis
 */
const MIN_IMAGE_WIDTH = 200
const MIN_IMAGE_HEIGHT = 200

/**
 * Common image file extensions
 */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']

/**
 * Common video file extensions
 */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv']

/**
 * Check if a URL points to an image
 */
export function isImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname.toLowerCase()
    return IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * Check if a URL points to a video
 */
export function isVideoUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname.toLowerCase()
    return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * Extract image URLs from HTML content
 */
export function extractImagesFromHtml(html: string, baseUrl: string): string[] {
  const images: string[] = []

  // Match img src attributes
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match

  while ((match = imgRegex.exec(html)) !== null) {
    try {
      const src = match[1]
      const absoluteUrl = new URL(src, baseUrl).href
      if (isValidImageUrl(absoluteUrl)) {
        images.push(absoluteUrl)
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // Match srcset for responsive images
  const srcsetRegex = /srcset=["']([^"']+)["']/gi
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1]
    const srcsetUrls = parseSrcset(srcset, baseUrl)
    images.push(...srcsetUrls.filter(isValidImageUrl))
  }

  // Match og:image meta tags
  const ogImageRegex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi
  while ((match = ogImageRegex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl).href
      if (isValidImageUrl(url)) {
        images.push(url)
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // Deduplicate
  return Array.from(new Set(images))
}

/**
 * Parse srcset attribute and extract URLs
 */
function parseSrcset(srcset: string, baseUrl: string): string[] {
  return srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean)
    .map((src) => {
      try {
        return new URL(src, baseUrl).href
      } catch {
        return null
      }
    })
    .filter((url): url is string => url !== null)
}

/**
 * Check if URL is a valid image URL (not a tracking pixel, etc.)
 */
function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)

    // Skip data URIs (too small, likely icons)
    if (urlObj.protocol === 'data:') {
      return false
    }

    // Skip common tracking pixels and icons
    const path = urlObj.pathname.toLowerCase()
    const skipPatterns = [
      '/pixel',
      '/tracking',
      '/beacon',
      '/1x1',
      '/spacer',
      'favicon',
      '.ico',
      '/ad/',
      '/analytics/',
    ]

    if (skipPatterns.some((pattern) => path.includes(pattern))) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Extract video URL from HTML content
 */
export function extractVideoFromHtml(html: string, baseUrl: string): string | null {
  // Match video src attributes
  const videoSrcRegex = /<video[^>]*>[\s\S]*?<source[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match = videoSrcRegex.exec(html)

  if (match) {
    try {
      return new URL(match[1], baseUrl).href
    } catch {
      // Continue to try other patterns
    }
  }

  // Match video element with direct src
  const videoDirectRegex = /<video[^>]+src=["']([^"']+)["']/gi
  match = videoDirectRegex.exec(html)

  if (match) {
    try {
      return new URL(match[1], baseUrl).href
    } catch {
      // Continue to try other patterns
    }
  }

  // Match og:video meta tags
  const ogVideoRegex = /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/gi
  match = ogVideoRegex.exec(html)

  if (match) {
    try {
      return new URL(match[1], baseUrl).href
    } catch {
      // Skip invalid URLs
    }
  }

  return null
}

/**
 * Extract media from a URL by fetching and parsing the page
 */
export async function extractMediaFromUrl(url: string): Promise<ExtractedMedia> {
  // SSRF protection
  const ssrfCheck = await validateUrlForFetch(url)
  if (!ssrfCheck.safe) {
    return { images: [], video: null }
  }

  // Check if URL directly points to media
  if (isImageUrl(url)) {
    return {
      images: [{ url }],
      video: null,
    }
  }

  if (isVideoUrl(url)) {
    return {
      images: [],
      video: { url },
    }
  }

  // Fetch the page and extract media
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; RealPressBot/1.0; +https://realpress.ai)',
      },
    })

    if (!response.ok) {
      return { images: [], video: null }
    }

    const html = await response.text()
    const images = extractImagesFromHtml(html, url).map((imgUrl) => ({ url: imgUrl }))
    const videoUrl = extractVideoFromHtml(html, url)

    return {
      images,
      video: videoUrl ? { url: videoUrl } : null,
    }
  } catch {
    return { images: [], video: null }
  }
}

/**
 * Filter images to get the most relevant ones for analysis
 * Prioritizes larger images and limits count
 */
export function filterRelevantImages(images: ImageInput[], maxCount: number = 5): ImageInput[] {
  // For MVP, just take the first N images
  // A more sophisticated approach would fetch image dimensions
  return images.slice(0, maxCount)
}
