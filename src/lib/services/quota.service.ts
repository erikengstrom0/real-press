/**
 * Quota Service
 *
 * Checks monthly API usage against tier-based quotas.
 * Queries the ApiUsage table for current-month totals.
 */

import prisma from '@/lib/db/prisma'
import type { UserTier } from '@/lib/api/check-tier'
import { MONTHLY_QUOTAS, type QuotaStatus } from '@/lib/config/quotas'

function getMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function getNextMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

/**
 * Get the current quota status for a user.
 */
export async function getQuotaStatus(userId: string, tier: UserTier): Promise<QuotaStatus> {
  const monthStart = getMonthStart()

  const used = await prisma.apiUsage.count({
    where: {
      userId,
      createdAt: { gte: monthStart },
    },
  })

  const limit = MONTHLY_QUOTAS[tier]
  const remaining = Math.max(0, limit - used)
  const percentUsed = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  return {
    tier,
    used,
    limit,
    remaining,
    resetsAt: getNextMonthStart().toISOString(),
    percentUsed,
  }
}

/**
 * Check whether a user is within their monthly quota.
 */
export async function checkQuota(
  userId: string,
  tier: UserTier
): Promise<{ allowed: boolean; status: QuotaStatus }> {
  const status = await getQuotaStatus(userId, tier)
  return {
    allowed: status.remaining > 0,
    status,
  }
}

/**
 * Record API usage after a successful request.
 * For batch endpoints, pass count = number of items processed.
 */
export async function recordApiUsage(
  userId: string,
  apiKeyId: string | null,
  endpoint: string,
  count: number = 1
): Promise<void> {
  if (count === 1) {
    await prisma.apiUsage.create({
      data: { userId, apiKeyId, endpoint },
    })
  } else {
    const records = Array.from({ length: count }, () => ({
      userId,
      apiKeyId,
      endpoint,
    }))
    await prisma.apiUsage.createMany({ data: records })
  }
}
