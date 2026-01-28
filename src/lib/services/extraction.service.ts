import { extract } from '@extractus/article-extractor'
import { createHash } from 'crypto'

export interface ExtractedContent {
  url: string
  domain: string
  title: string | null
  description: string | null
  contentText: string
  contentHash: string
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
    throw new ExtractionError(
      `Failed to extract content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      url
    )
  }
}
