import prisma from '@/lib/db/prisma'
import type { UserTier } from '@/lib/api/check-tier'

const MAX_HISTORY: Record<UserTier, number> = {
  free: 20,
  pro: 500,
  enterprise: Infinity,
}

export interface RecordSearchInput {
  query: string
  resultsCount: number
  filters?: Record<string, unknown>
}

export async function recordSearch(
  userId: string,
  tier: UserTier,
  input: RecordSearchInput
) {
  await prisma.searchHistory.create({
    data: {
      userId,
      query: input.query,
      resultsCount: input.resultsCount,
      filters: input.filters
        ? JSON.parse(JSON.stringify(input.filters))
        : undefined,
    },
  })

  // Enforce history limit by deleting oldest entries beyond the cap
  const limit = MAX_HISTORY[tier]
  if (limit !== Infinity) {
    const count = await prisma.searchHistory.count({ where: { userId } })
    if (count > limit) {
      const toDelete = await prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: count - limit,
        select: { id: true },
      })
      if (toDelete.length > 0) {
        await prisma.searchHistory.deleteMany({
          where: { id: { in: toDelete.map((r) => r.id) } },
        })
      }
    }
  }
}

export async function getSearchHistory(
  userId: string,
  options?: { limit?: number; offset?: number }
) {
  const take = Math.min(options?.limit ?? 20, 100)
  const skip = options?.offset ?? 0

  return prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  })
}

export async function clearSearchHistory(userId: string) {
  return prisma.searchHistory.deleteMany({ where: { userId } })
}
