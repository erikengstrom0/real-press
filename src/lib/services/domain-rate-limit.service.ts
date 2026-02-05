import prisma from '@/lib/db/prisma'

const DEFAULT_CRAWL_DELAY_MS = 1000
const WINDOW_SIZE_MS = 60000 // 1 minute window

export async function getOrCreateDomain(domain: string) {
  // Use upsert to handle race conditions when multiple jobs hit the same domain
  const domainConfig = await prisma.crawlDomain.upsert({
    where: { domain },
    update: {}, // No updates needed, just return existing
    create: { domain },
  })

  return domainConfig
}

export async function checkDomainRateLimit(domain: string): Promise<boolean> {
  const now = new Date()
  const domainConfig = await getOrCreateDomain(domain)

  // Check if domain is blocked
  if (!domainConfig.isAllowed) {
    return false
  }

  // Check sliding window rate limit
  const windowStart = new Date(now.getTime() - WINDOW_SIZE_MS)

  if (domainConfig.windowStart < windowStart) {
    // Window expired, reset counter
    await prisma.crawlDomain.update({
      where: { domain },
      data: {
        requestsInWindow: 0,
        windowStart: now,
      },
    })
    return true
  }

  // Calculate max requests allowed in window
  const crawlDelay = domainConfig.crawlDelayMs || DEFAULT_CRAWL_DELAY_MS
  const maxRequestsPerWindow = Math.floor(WINDOW_SIZE_MS / crawlDelay) * domainConfig.maxConcurrent

  return domainConfig.requestsInWindow < maxRequestsPerWindow
}

export async function recordDomainRequest(domain: string, success: boolean = true): Promise<void> {
  const updateData: Record<string, unknown> = {
    requestsInWindow: { increment: 1 },
  }

  if (success) {
    updateData.totalCrawled = { increment: 1 }
  } else {
    updateData.totalFailed = { increment: 1 }
  }

  await prisma.crawlDomain.upsert({
    where: { domain },
    update: updateData,
    create: {
      domain,
      requestsInWindow: 1,
      totalCrawled: success ? 1 : 0,
      totalFailed: success ? 0 : 1,
    },
  })
}

export async function updateDomainAverageScore(domain: string): Promise<void> {
  // Calculate average AI score for content from this domain using raw query for join
  const avgResult = await prisma.$queryRaw<[{ avg: number | null }]>`
    SELECT AVG(a.composite_score) as avg
    FROM content c
    JOIN ai_scores a ON c.id = a.content_id
    WHERE c.domain = ${domain} AND c.status = 'analyzed'
  `

  if (avgResult[0]?.avg !== null) {
    await prisma.crawlDomain.update({
      where: { domain },
      data: { avgAiScore: avgResult[0].avg },
    })
  }
}

export async function blockDomain(domain: string, reason?: string): Promise<void> {
  await prisma.crawlDomain.upsert({
    where: { domain },
    update: { isAllowed: false },
    create: { domain, isAllowed: false },
  })
}

export async function unblockDomain(domain: string): Promise<void> {
  await prisma.crawlDomain.update({
    where: { domain },
    data: { isAllowed: true },
  })
}

export async function setDomainPriority(domain: string, isPriority: boolean): Promise<void> {
  await prisma.crawlDomain.upsert({
    where: { domain },
    update: { isPriority },
    create: { domain, isPriority },
  })
}

export async function updateDomainConfig(
  domain: string,
  config: {
    crawlDelayMs?: number
    maxConcurrent?: number
    rssUrl?: string
    sitemapUrl?: string
  }
): Promise<void> {
  await prisma.crawlDomain.upsert({
    where: { domain },
    update: config,
    create: { domain, ...config },
  })
}

export async function getDomainStats(domain: string) {
  const domainConfig = await prisma.crawlDomain.findUnique({
    where: { domain },
  })

  if (!domainConfig) {
    return null
  }

  const [pendingJobs, contentCount] = await Promise.all([
    prisma.crawlJob.count({
      where: { domain, status: 'PENDING' },
    }),
    prisma.content.count({
      where: { domain },
    }),
  ])

  return {
    ...domainConfig,
    pendingJobs,
    contentCount,
  }
}

export async function listDomains(options: { limit?: number; offset?: number; priorityOnly?: boolean }) {
  const { limit = 50, offset = 0, priorityOnly = false } = options

  const where = priorityOnly ? { isPriority: true } : {}

  const [domains, total] = await Promise.all([
    prisma.crawlDomain.findMany({
      where,
      orderBy: { totalCrawled: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.crawlDomain.count({ where }),
  ])

  return { domains, total }
}
