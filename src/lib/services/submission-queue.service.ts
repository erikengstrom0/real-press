import prisma from '@/lib/db/prisma'
import { SubmissionStatus } from '@/generated/prisma/client'
import { extractContent, ExtractionError } from './extraction.service'
import { getContentByUrl, createContentFromExtraction } from './content.service'
import {
  analyzeMultiModalAndStore,
} from './ai-detection.service'
import {
  extractMediaFromUrl,
  filterRelevantImages,
} from './media-extraction.service'
import type { UserTier } from '@/lib/api/check-tier'

const PRIORITY_MAP: Record<UserTier, number> = {
  free: 0,
  pro: 10,
  enterprise: 20,
}

export interface EnqueueInput {
  userId?: string
  url: string
  tier: UserTier
  extractMedia?: boolean
  imageUrls?: string[]
  videoUrl?: string
}

export interface JobStatus {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  stage?: string
  progress?: number
  position?: number
  contentId?: string
  error?: string
  aiScore?: { score: number; classification: string }
}

interface ProcessResult {
  jobId: string
  status: 'success' | 'failed' | 'skipped'
  contentId?: string
  error?: string
  duration?: number
}

export async function enqueueSubmission(
  input: EnqueueInput
): Promise<{ jobId: string; position: number }> {
  const priority = PRIORITY_MAP[input.tier] ?? 0

  const job = await prisma.submissionJob.create({
    data: {
      userId: input.userId || null,
      url: input.url,
      priority,
      extractMedia: input.extractMedia ?? true,
      imageUrls: input.imageUrls ?? [],
      videoUrl: input.videoUrl || null,
    },
  })

  // Count jobs ahead in queue (higher priority or same priority but earlier)
  const position = await prisma.submissionJob.count({
    where: {
      status: SubmissionStatus.QUEUED,
      OR: [
        { priority: { gt: priority } },
        {
          priority,
          createdAt: { lt: job.createdAt },
        },
      ],
    },
  })

  return { jobId: job.id, position: position + 1 }
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  const job = await prisma.submissionJob.findUnique({
    where: { id: jobId },
  })

  if (!job) return null

  const base: JobStatus = {
    id: job.id,
    status: job.status.toLowerCase() as JobStatus['status'],
    stage: job.stage || undefined,
    progress: job.progress,
  }

  if (job.status === SubmissionStatus.QUEUED) {
    const position = await prisma.submissionJob.count({
      where: {
        status: SubmissionStatus.QUEUED,
        OR: [
          { priority: { gt: job.priority } },
          {
            priority: job.priority,
            createdAt: { lt: job.createdAt },
          },
        ],
      },
    })
    base.position = position + 1
  }

  if (job.status === SubmissionStatus.COMPLETED && job.contentId) {
    base.contentId = job.contentId
    // Fetch the AI score for the completed content
    const aiScore = await prisma.aiScore.findUnique({
      where: { contentId: job.contentId },
      select: { compositeScore: true, classification: true },
    })
    if (aiScore) {
      base.aiScore = {
        score: aiScore.compositeScore,
        classification: aiScore.classification,
      }
    }
  }

  if (job.status === SubmissionStatus.FAILED) {
    base.error = job.error || 'Processing failed'
  }

  return base
}

export async function getQueueStats(): Promise<{
  queued: number
  processing: number
}> {
  const [queued, processing] = await Promise.all([
    prisma.submissionJob.count({
      where: { status: SubmissionStatus.QUEUED },
    }),
    prisma.submissionJob.count({
      where: { status: SubmissionStatus.PROCESSING },
    }),
  ])

  return { queued, processing }
}

async function claimNextSubmissionJob() {
  // Find the highest-priority, oldest queued job
  const job = await prisma.submissionJob.findFirst({
    where: { status: SubmissionStatus.QUEUED },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })

  if (!job) return null

  // Atomically claim it
  const claimed = await prisma.submissionJob.updateMany({
    where: {
      id: job.id,
      status: SubmissionStatus.QUEUED,
    },
    data: {
      status: SubmissionStatus.PROCESSING,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  })

  if (claimed.count === 0) return null

  return prisma.submissionJob.findUnique({ where: { id: job.id } })
}

async function processSubmissionJob(
  job: NonNullable<Awaited<ReturnType<typeof claimNextSubmissionJob>>>
): Promise<ProcessResult> {
  const startTime = Date.now()

  try {
    // Stage 1: Extracting content
    await prisma.submissionJob.update({
      where: { id: job.id },
      data: { stage: 'extracting', progress: 10 },
    })

    // Check if URL was already processed while queued
    const existing = await getContentByUrl(job.url)
    if (existing) {
      await prisma.submissionJob.update({
        where: { id: job.id },
        data: {
          status: SubmissionStatus.COMPLETED,
          contentId: existing.id,
          stage: 'complete',
          progress: 100,
          completedAt: new Date(),
        },
      })
      return {
        jobId: job.id,
        status: 'success',
        contentId: existing.id,
        duration: Date.now() - startTime,
      }
    }

    const extracted = await extractContent(job.url)

    await prisma.submissionJob.update({
      where: { id: job.id },
      data: { progress: 40 },
    })

    const content = await createContentFromExtraction(extracted)

    // Stage 2: Running AI detection
    await prisma.submissionJob.update({
      where: { id: job.id },
      data: { stage: 'analyzing', progress: 50 },
    })

    // Collect media
    const images: Array<{ url?: string; base64?: string }> = []
    let videoUrl: string | undefined

    if (job.imageUrls && job.imageUrls.length > 0) {
      for (const imgUrl of job.imageUrls) {
        images.push({ url: imgUrl })
      }
    }

    if (job.videoUrl) {
      videoUrl = job.videoUrl
    }

    if (job.extractMedia) {
      const extractedMedia = await extractMediaFromUrl(job.url)
      const relevantImages = filterRelevantImages(extractedMedia.images, 5)
      for (const img of relevantImages) {
        if (!images.some((i) => i.url === img.url)) {
          images.push(img)
        }
      }
      if (!videoUrl && extractedMedia.video) {
        videoUrl = extractedMedia.video.url
      }
    }

    await prisma.submissionJob.update({
      where: { id: job.id },
      data: { progress: 70 },
    })

    // Always run multi-modal analysis (handles text-only gracefully when no media found)
    await analyzeMultiModalAndStore(content.id, {
      text: extracted.contentText,
      images: images.length > 0 ? images : undefined,
      videoUrl,
    })

    // Stage 3: Complete
    await prisma.submissionJob.update({
      where: { id: job.id },
      data: {
        status: SubmissionStatus.COMPLETED,
        contentId: content.id,
        stage: 'complete',
        progress: 100,
        completedAt: new Date(),
      },
    })

    return {
      jobId: job.id,
      status: 'success',
      contentId: content.id,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    const errorMessage =
      error instanceof ExtractionError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error'

    // Check if retryable
    const isRetryable =
      !(error instanceof ExtractionError) ||
      !['403', '404', '401'].some((code) => errorMessage.includes(code))

    const canRetry = isRetryable && job.attempts < job.maxAttempts

    await prisma.submissionJob.update({
      where: { id: job.id },
      data: {
        status: canRetry ? SubmissionStatus.QUEUED : SubmissionStatus.FAILED,
        error: errorMessage,
        stage: null,
        progress: 0,
        ...(canRetry ? { startedAt: null } : { completedAt: new Date() }),
      },
    })

    return {
      jobId: job.id,
      status: 'failed',
      error: errorMessage,
      duration: Date.now() - startTime,
    }
  }
}

export async function processNextJob(): Promise<ProcessResult | null> {
  const job = await claimNextSubmissionJob()
  if (!job) return null
  return processSubmissionJob(job)
}

export async function processSubmissionBatch(
  batchSize: number = 5
): Promise<{
  processed: number
  succeeded: number
  failed: number
  details: ProcessResult[]
}> {
  const result = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    details: [] as ProcessResult[],
  }

  for (let i = 0; i < batchSize; i++) {
    const jobResult = await processNextJob()
    if (!jobResult) break

    result.processed++
    result.details.push(jobResult)

    if (jobResult.status === 'success') {
      result.succeeded++
    } else {
      result.failed++
    }
  }

  return result
}
