import { claimNextJob, completeJob, failJob } from './crawl-job.service'
import { extractContent, fetchHtml, ExtractionError } from './extraction.service'
import { analyzeAndStoreScore } from './ai-detection.service'
import {
  checkDomainRateLimit,
  recordDomainRequest,
  updateDomainAverageScore,
} from './domain-rate-limit.service'
import {
  analyzeContent,
  countLinks,
  countImages,
  hasVideoContent,
} from './content-analysis.service'
import { extractMetadata } from './metadata-extraction.service'
import { extractTopics, linkContentToTopics } from './topic-extraction.service'
import { getOrCreateAuthor, updateAuthorStats } from './author.service'
import prisma from '@/lib/db/prisma'
import type { CrawlJob } from '@/generated/prisma/client'

interface ProcessOptions {
  batchSize?: number
  maxConcurrent?: number
}

interface JobResult {
  jobId: string
  url: string
  status: 'success' | 'failed' | 'rate_limited'
  contentId?: string
  error?: string
  duration?: number
}

interface ProcessResult {
  processed: number
  succeeded: number
  failed: number
  rateLimited: number
  details: JobResult[]
}

async function processJob(job: CrawlJob): Promise<JobResult> {
  const startTime = Date.now()

  try {
    // Check domain rate limit
    const canProceed = await checkDomainRateLimit(job.domain)
    if (!canProceed) {
      await failJob(job.id, 'Domain rate limit exceeded')
      return {
        jobId: job.id,
        url: job.url,
        status: 'rate_limited',
      }
    }

    // Record that we're making a request to this domain
    await recordDomainRequest(job.domain, true)

    // Fetch HTML for metadata extraction (may fail, that's ok)
    let html: string | null = null
    try {
      html = await fetchHtml(job.url)
    } catch {
      // Continue without HTML metadata
    }

    // Extract content using existing service
    const extracted = await extractContent(job.url)

    // Run content analysis
    const analysis = analyzeContent(extracted.contentText)

    // Extract metadata from HTML
    let metadata = {
      publishedAt: null as Date | null,
      author: null as string | null,
      canonicalUrl: null as string | null,
      siteName: null as string | null,
      ogType: null as string | null,
      schemaType: null as string | null,
      language: 'en' as string | null,
    }

    let linkCount = 0
    let externalLinkCount = 0
    let imageCount = 0
    let hasVideo = false

    if (html) {
      metadata = await extractMetadata(html)
      const links = countLinks(html)
      linkCount = links.total
      externalLinkCount = links.external
      imageCount = countImages(html)
      hasVideo = hasVideoContent(html)
    }

    // Handle author
    let authorId: string | null = null
    if (metadata.author) {
      const author = await getOrCreateAuthor(metadata.author, extracted.domain)
      authorId = author.id
    }

    // Create content record with all metadata
    const content = await prisma.content.create({
      data: {
        url: extracted.url,
        domain: extracted.domain,
        title: extracted.title,
        description: extracted.description,
        contentText: extracted.contentText,
        contentHash: extracted.contentHash,
        sourceType: job.sourceType || 'scraped',
        status: 'pending',

        // Publication metadata
        publishedAt: metadata.publishedAt,
        author: metadata.author,
        language: metadata.language || 'en',

        // Content metrics
        wordCount: analysis.wordCount,
        sentenceCount: analysis.sentenceCount,
        paragraphCount: analysis.paragraphCount,
        readingLevel: analysis.readingLevel,
        linkCount,
        externalLinkCount,
        imageCount,
        hasVideo,

        // Stylometric analysis
        vocabularyDiversity: analysis.vocabularyDiversity,
        avgSentenceLength: analysis.avgSentenceLength,
        sentenceLengthVariance: analysis.sentenceLengthVariance,
        punctuationDiversity: analysis.punctuationDiversity,
        repetitionScore: analysis.repetitionScore,

        // Advanced NLP metrics
        sentimentScore: analysis.sentimentScore,
        namedEntityDensity: analysis.namedEntityDensity,
        temporalReferenceDensity: analysis.temporalReferenceDensity,

        // Source provenance
        canonicalUrl: metadata.canonicalUrl,
        siteName: metadata.siteName,
        ogType: metadata.ogType,
        schemaType: metadata.schemaType,

        // Author relation
        authorId,

        // Historical tracking - initial version
        contentVersions: [
          {
            hash: extracted.contentHash,
            fetchedAt: new Date().toISOString(),
          },
        ],
      },
    })

    // Run AI detection
    await analyzeAndStoreScore(content.id, extracted.contentText)

    // Extract and link topics
    const topics = extractTopics(extracted.contentText, 5)
    if (topics.length > 0) {
      await linkContentToTopics(content.id, topics)
    }

    // Update author stats in background
    if (authorId) {
      updateAuthorStats(authorId).catch(() => {})
    }

    // Mark job as complete
    await completeJob(job.id, content.id)

    // Update domain average score in background
    updateDomainAverageScore(job.domain).catch(() => {})

    const duration = Date.now() - startTime

    return {
      jobId: job.id,
      url: job.url,
      status: 'success',
      contentId: content.id,
      duration,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Record failed request
    await recordDomainRequest(job.domain, false)

    // Mark job as failed (will retry with backoff)
    await failJob(job.id, errorMessage)

    // Fast-track permanent errors to dead letter
    if (error instanceof ExtractionError) {
      const permanentErrors = ['403', '404', '401', 'Forbidden', 'Not Found', 'Unauthorized']
      const isPermanent = permanentErrors.some((e) => errorMessage.includes(e))

      if (isPermanent) {
        // Could mark as dead letter immediately here if desired
      }
    }

    return {
      jobId: job.id,
      url: job.url,
      status: 'failed',
      error: errorMessage,
      duration: Date.now() - startTime,
    }
  }
}

export async function processJobBatch(options: ProcessOptions = {}): Promise<ProcessResult> {
  const { batchSize = 5, maxConcurrent = 3 } = options

  const result: ProcessResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    rateLimited: 0,
    details: [],
  }

  // Claim jobs up to batch size
  const jobs: CrawlJob[] = []
  for (let i = 0; i < batchSize; i++) {
    const job = await claimNextJob()
    if (!job) break
    jobs.push(job)
  }

  if (jobs.length === 0) {
    return result
  }

  // Process jobs with concurrency limit
  const chunks: CrawlJob[][] = []
  for (let i = 0; i < jobs.length; i += maxConcurrent) {
    chunks.push(jobs.slice(i, i + maxConcurrent))
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(processJob))

    for (const jobResult of chunkResults) {
      result.processed++
      result.details.push(jobResult)

      switch (jobResult.status) {
        case 'success':
          result.succeeded++
          break
        case 'failed':
          result.failed++
          break
        case 'rate_limited':
          result.rateLimited++
          break
      }
    }
  }

  return result
}

export async function processSingleJob(): Promise<JobResult | null> {
  const job = await claimNextJob()
  if (!job) return null

  return processJob(job)
}
