/**
 * API Usage Tracking Service
 *
 * Records and queries API usage for billing and analytics.
 * Uses daily aggregation via Prisma upsert on the @@unique constraint.
 */

import prisma from '@/lib/db/prisma'

/**
 * Record a single API request. Fire-and-forget — never blocks the response.
 * Upserts the daily aggregation row, incrementing requestCount or errorCount.
 */
export function recordUsage(
  userId: string,
  apiKeyId: string | null,
  endpoint: string,
  isError: boolean = false
): void {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // For the composite unique key, use empty string when apiKeyId is null
  // because Prisma's composite unique doesn't work well with null values.
  const keyIdForLookup = apiKeyId ?? ''

  prisma.apiUsage.upsert({
    where: {
      userId_apiKeyId_endpoint_date: {
        userId,
        apiKeyId: keyIdForLookup,
        endpoint,
        date: today,
      },
    },
    update: isError
      ? { errorCount: { increment: 1 } }
      : { requestCount: { increment: 1 } },
    create: {
      userId,
      apiKeyId: apiKeyId || null,
      endpoint,
      date: today,
      requestCount: isError ? 0 : 1,
      errorCount: isError ? 1 : 0,
    },
  }).catch((err) => {
    console.error('Usage tracking error:', err)
  })
}

/**
 * Get usage stats for a user over the last N days.
 */
export async function getUsageStats(userId: string, days: number = 30) {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - days)

  const daily = await prisma.apiUsage.findMany({
    where: {
      userId,
      date: { gte: since },
    },
    select: {
      date: true,
      endpoint: true,
      requestCount: true,
      errorCount: true,
    },
    orderBy: { date: 'asc' },
  })

  // Calculate totals by endpoint
  const totals: Record<string, number> = {}
  let total = 0
  for (const row of daily) {
    totals[row.endpoint] = (totals[row.endpoint] || 0) + row.requestCount
    total += row.requestCount
  }

  return {
    daily: daily.map(row => ({
      date: row.date.toISOString().split('T')[0],
      endpoint: row.endpoint,
      requestCount: row.requestCount,
      errorCount: row.errorCount,
    })),
    totals: { ...totals, total },
  }
}

/**
 * Get usage stats filtered to a specific API key.
 */
export async function getUsageByKey(userId: string, apiKeyId: string, days: number = 30) {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - days)

  const daily = await prisma.apiUsage.findMany({
    where: {
      userId,
      apiKeyId,
      date: { gte: since },
    },
    select: {
      date: true,
      endpoint: true,
      requestCount: true,
      errorCount: true,
    },
    orderBy: { date: 'asc' },
  })

  const totals: Record<string, number> = {}
  let total = 0
  for (const row of daily) {
    totals[row.endpoint] = (totals[row.endpoint] || 0) + row.requestCount
    total += row.requestCount
  }

  return {
    daily: daily.map(row => ({
      date: row.date.toISOString().split('T')[0],
      endpoint: row.endpoint,
      requestCount: row.requestCount,
      errorCount: row.errorCount,
    })),
    totals: { ...totals, total },
  }
}
