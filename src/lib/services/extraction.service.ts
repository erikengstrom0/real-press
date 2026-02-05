import { extract } from '@extractus/article-extractor'
import { createHash } from 'crypto'

export interface ExtractedContent {
  url: string
  domain: string
  title: string | null
  description: string | null
  contentText: string
  contentHash: string
  html?: string
}

export class ExtractionError extends Error {
  constructor(message: string, public readonly url: string) {
    super(message)
    this.name = 'ExtractionError'
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    throw new ExtractionError('Invalid URL format', url)
  }
}

function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RealPressBot/1.0 (https://real.press)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return response.text()
}

export async function extractContent(url: string): Promise<ExtractedContent> {
  const domain = extractDomain(url)

  try {
    const article = await extract(url)

    if (!article) {
      throw new ExtractionError('Could not extract content from URL', url)
    }

    const contentText = article.content
      ? article.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : ''

    if (!contentText || contentText.length < 100) {
      throw new ExtractionError(
        'Extracted content is too short (minimum 100 characters required)',
        url
      )
    }

    return {
      url,
      domain,
      title: article.title || null,
      description: article.description || null,
      contentText,
      contentHash: generateContentHash(contentText),
    }
  } catch (error) {
    if (error instanceof ExtractionError) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Detect HTTP error codes and provide user-friendly messages
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      throw new ExtractionError(
        `This website (${domain}) has blocked automated access. Sites like Reddit, Twitter/X, and LinkedIn use anti-bot protection that prevents content extraction. Try submitting a blog post, news article, or other publicly accessible page instead.`,
        url
      )
    }

    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      throw new ExtractionError(
        `This content requires authentication to access. Real Press can only analyze publicly accessible pages. Try a different URL that doesn't require login.`,
        url
      )
    }

    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      throw new ExtractionError(
        `The page was not found (404). Please check that the URL is correct and the page still exists.`,
        url
      )
    }

    if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
      throw new ExtractionError(
        `This website is rate-limiting our requests. Please wait a moment and try again, or try a different website.`,
        url
      )
    }

    if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
      throw new ExtractionError(
        `The website is experiencing server issues and couldn't respond. Please try again later.`,
        url
      )
    }

    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      throw new ExtractionError(
        `Could not find the website. Please check that the URL is spelled correctly.`,
        url
      )
    }

    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      throw new ExtractionError(
        `The website took too long to respond. Please try again or try a different URL.`,
        url
      )
    }

    throw new ExtractionError(
      `Failed to extract content: ${errorMessage}`,
      url
    )
  }
}
