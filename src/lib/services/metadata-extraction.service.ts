/**
 * Metadata Extraction Service
 * Extracts publication metadata from HTML (dates, authors, provenance).
 */

export interface ExtractedMetadata {
  publishedAt: Date | null
  author: string | null
  canonicalUrl: string | null
  siteName: string | null
  ogType: string | null
  schemaType: string | null
  language: string | null
}

function extractMetaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  return null
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null

  try {
    // Try ISO format first
    const isoDate = new Date(dateStr)
    if (!isNaN(isoDate.getTime())) {
      return isoDate
    }

    // Try common formats
    const formats = [
      // "January 15, 2024"
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
      // "15 January 2024"
      /(\d{1,2})\s+(\w+)\s+(\d{4})/,
      // "2024-01-15"
      /(\d{4})-(\d{2})-(\d{2})/,
      // "01/15/2024"
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    ]

    for (const format of formats) {
      const match = dateStr.match(format)
      if (match) {
        const parsed = new Date(dateStr)
        if (!isNaN(parsed.getTime())) {
          return parsed
        }
      }
    }

    return null
  } catch {
    return null
  }
}

function extractPublishedDate(html: string): Date | null {
  // Priority order for date extraction
  const datePatterns = [
    // Open Graph
    /<meta\s+[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
    // Schema.org datePublished
    /"datePublished"\s*:\s*"([^"]+)"/i,
    // Dublin Core
    /<meta\s+[^>]*name=["']DC\.date["'][^>]*content=["']([^"']+)["']/i,
    /<meta\s+[^>]*name=["']dcterms\.created["'][^>]*content=["']([^"']+)["']/i,
    // Generic date meta
    /<meta\s+[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i,
    /<meta\s+[^>]*name=["']publish[_-]?date["'][^>]*content=["']([^"']+)["']/i,
    // Time element
    /<time[^>]*datetime=["']([^"']+)["'][^>]*>/i,
    // Pubdate attribute
    /<[^>]+pubdate[^>]*datetime=["']([^"']+)["']/i,
  ]

  const dateStr = extractMetaContent(html, datePatterns)
  return parseDate(dateStr)
}

function extractAuthor(html: string): string | null {
  const authorPatterns = [
    // Open Graph
    /<meta\s+[^>]*property=["'](?:article:)?author["'][^>]*content=["']([^"']+)["']/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["'](?:article:)?author["']/i,
    // Schema.org
    /"author"\s*:\s*\{\s*[^}]*"name"\s*:\s*"([^"]+)"/i,
    /"author"\s*:\s*"([^"]+)"/i,
    // Twitter
    /<meta\s+[^>]*name=["']twitter:creator["'][^>]*content=["']([^"']+)["']/i,
    // Generic author meta
    /<meta\s+[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i,
    // Byline patterns in content
    /<[^>]*class=["'][^"']*(?:author|byline)[^"']*["'][^>]*>([^<]+)</i,
    /(?:by|written by|author:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
  ]

  const author = extractMetaContent(html, authorPatterns)

  if (author) {
    // Clean up author string
    return author
      .replace(/@\w+/g, '') // Remove Twitter handles
      .replace(/^\s*by\s*/i, '') // Remove "by" prefix
      .trim()
  }

  return null
}

function extractCanonicalUrl(html: string): string | null {
  const patterns = [
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
    /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i,
    /<meta\s+[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i,
  ]

  return extractMetaContent(html, patterns)
}

function extractSiteName(html: string): string | null {
  const patterns = [
    /<meta\s+[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i,
    /"publisher"\s*:\s*\{\s*[^}]*"name"\s*:\s*"([^"]+)"/i,
    /<meta\s+[^>]*name=["']application-name["'][^>]*content=["']([^"']+)["']/i,
  ]

  return extractMetaContent(html, patterns)
}

function extractOgType(html: string): string | null {
  const patterns = [
    /<meta\s+[^>]*property=["']og:type["'][^>]*content=["']([^"']+)["']/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:type["']/i,
  ]

  return extractMetaContent(html, patterns)
}

function extractSchemaType(html: string): string | null {
  const patterns = [
    /"@type"\s*:\s*"([^"]+)"/i,
    /itemtype=["']https?:\/\/schema\.org\/([^"']+)["']/i,
  ]

  return extractMetaContent(html, patterns)
}

function extractLanguage(html: string): string | null {
  const patterns = [
    /<html[^>]*lang=["']([^"']+)["']/i,
    /<meta\s+[^>]*http-equiv=["']content-language["'][^>]*content=["']([^"']+)["']/i,
    /<meta\s+[^>]*property=["']og:locale["'][^>]*content=["']([^"']+)["']/i,
  ]

  const lang = extractMetaContent(html, patterns)
  if (lang) {
    // Normalize to 2-letter code
    return lang.split('-')[0].toLowerCase()
  }

  return 'en' // Default to English
}

export async function extractMetadata(html: string): Promise<ExtractedMetadata> {
  return {
    publishedAt: extractPublishedDate(html),
    author: extractAuthor(html),
    canonicalUrl: extractCanonicalUrl(html),
    siteName: extractSiteName(html),
    ogType: extractOgType(html),
    schemaType: extractSchemaType(html),
    language: extractLanguage(html),
  }
}

export async function fetchAndExtractMetadata(url: string): Promise<ExtractedMetadata | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RealPressBot/1.0 (https://real.press)',
      },
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    return extractMetadata(html)
  } catch {
    return null
  }
}
