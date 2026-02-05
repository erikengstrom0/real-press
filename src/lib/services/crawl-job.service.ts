import { createHash } from 'crypto'
import prisma from '@/lib/db/prisma'
import { CrawlStatus } from '@/generated/prisma/client'

interface CreateJobInput {
  url: string
  sourceType?: string
  priority?: number
  metadata?: Record<string, unknown>
}

interface CreateJobResult {
  created: boolean
  job?: Awaited<ReturnType<typeof prisma.crawlJob.create>>
  reason?: 'duplicate_job' | 'already_indexed'
  existingId?: string
}

function generateUrlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'unknown'
  }
}

export async function createCrawlJob(input: CreateJobInput): Promise<CreateJobResult> {
  const urlHash = generateUrlHash(input.url)
  const domain = extractDomain(input.url)

  // Check for existing job
  const existingJob = await prisma.crawlJob.findUnique({
    where: { urlHash },
  })

  if (existingJob) {
    return { created: false, reason: 'duplicate_job', existingId: existingJob.id }
  }

  // Check for existing content
  const existingContent = await prisma.content.findUnique({
    where: { url: input.url },
  })

  if (existingContent) {
    return { created: false, reason: 'already_indexed', existingId: existingContent.id }
  }

  const job = await prisma.crawlJob.create({
    data: {
      url: input.url,
      urlHash,
      domain,
      sourceType: input.sourceType || 'discovered',
      priority: input.priority || 0,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    },
  })

  return { created: true, job }
}

export async function createCrawlJobsBatch(
  urls: string[],
  sourceType: string = 'discovered',
  priority: number = 0
): Promise<{ created: number; duplicates: number }> {
  const jobsData = urls.map((url) => ({
    url,
    urlHash: generateUrlHash(url),
    domain: extractDomain(url),
    sourceType,
    priority,
  }))

  // Get existing URL hashes from both jobs and content
  const urlHashes = jobsData.map((j) => j.urlHash)

  const [existingJobs, existingContent] = await Promise.all([
    prisma.crawlJob.findMany({
      where: { urlHash: { in: urlHashes } },
      select: { urlHash: true },
    }),
    prisma.content.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    }),
  ])

  const existingJobHashes = new Set(existingJobs.map((j) => j.urlHash))
  const existingContentUrls = new Set(existingContent.map((c) => c.url))

  const newJobs = jobsData.filter(
    (j) => !existingJobHashes.has(j.urlHash) && !existingContentUrls.has(j.url)
  )

  if (newJobs.length === 0) {
    return { created: 0, duplicates: urls.length }
  }

  const result = await prisma.crawlJob.createMany({
    data: newJobs,
    skipDuplicates: true,
  })

  return {
    created: result.count,
    duplicates: urls.length - result.count,
  }
}

export async function claimNextJob(): Promise<Awaited<
  ReturnType<typeof prisma.crawlJob.findFirst>
> | null> {
  // Use a transaction to atomically claim a job
  const job = await prisma.$transaction(async (tx) => {
    // Find next available job
    const pendingJob = await tx.crawlJob.findFirst({
      where: {
        status: CrawlStatus.PENDING,
        scheduledAt: { lte: new Date() },
        attempts: { lt: 3 },
      },
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
    })

    if (!pendingJob) return null

    // Claim it by updating status
    const claimed = await tx.crawlJob.update({
      where: { id: pendingJob.id },
      data: {
        status: CrawlStatus.PROCESSING,
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    })

    return claimed
  })

  return job
}

export async function completeJob(jobId: string, contentId: string): Promise<void> {
  await prisma.crawlJob.update({
    where: { id: jobId },
    data: {
      status: CrawlStatus.COMPLETED,
      completedAt: new Date(),
      contentId,
    },
  })
}

export async function failJob(jobId: string, error: string): Promise<void> {
  const job = await prisma.crawlJob.findUnique({ where: { id: jobId } })

  if (!job) return

  const newStatus =
    job.attempts >= job.maxAttempts ? CrawlStatus.DEAD_LETTER : CrawlStatus.PENDING

  // Exponential backoff: 2^attempts seconds (2s, 4s, 8s, 16s...)
  const backoffMs = Math.pow(2, job.attempts) * 1000
  const scheduledAt =
    newStatus === CrawlStatus.PENDING ? new Date(Date.now() + backoffMs) : job.scheduledAt

  await prisma.crawlJob.update({
    where: { id: jobId },
    data: {
      status: newStatus,
      lastError: error,
      scheduledAt,
    },
  })
}

export async function getJobStats(): Promise<{
  pending: number
  processing: number
  completed: number
  failed: number
  deadLetter: number
}> {
  const [pending, processing, completed, failed, deadLetter] = await Promise.all([
    prisma.crawlJob.count({ where: { status: CrawlStatus.PENDING } }),
    prisma.crawlJob.count({ where: { status: CrawlStatus.PROCESSING } }),
    prisma.crawlJob.count({ where: { status: CrawlStatus.COMPLETED } }),
    prisma.crawlJob.count({ where: { status: CrawlStatus.FAILED } }),
    prisma.crawlJob.count({ where: { status: CrawlStatus.DEAD_LETTER } }),
  ])

  return { pending, processing, completed, failed, deadLetter }
}

export async function retryFailedJob(jobId: string): Promise<boolean> {
  const job = await prisma.crawlJob.findUnique({ where: { id: jobId } })

  if (!job || (job.status !== CrawlStatus.FAILED && job.status !== CrawlStatus.DEAD_LETTER)) {
    return false
  }

  await prisma.crawlJob.update({
    where: { id: jobId },
    data: {
      status: CrawlStatus.PENDING,
      scheduledAt: new Date(),
      attempts: 0,
      lastError: null,
    },
  })

  return true
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const job = await prisma.crawlJob.findUnique({ where: { id: jobId } })

  if (!job || job.status === CrawlStatus.COMPLETED) {
    return false
  }

  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { status: CrawlStatus.CANCELLED },
  })

  return true
}

export async function listJobs(options: {
  status?: CrawlStatus
  domain?: string
  limit?: number
  offset?: number
}) {
  const { status, domain, limit = 50, offset = 0 } = options

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (domain) where.domain = domain

  const [jobs, total] = await Promise.all([
    prisma.crawlJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.crawlJob.count({ where }),
  ])

  return { jobs, total }
}
