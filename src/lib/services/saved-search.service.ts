import prisma from '@/lib/db/prisma'
import type { UserTier } from '@/lib/api/check-tier'

const MAX_SAVED_SEARCHES: Record<UserTier, number> = {
  free: 5,
  pro: 50,
  enterprise: Infinity,
}

export interface CreateSavedSearchInput {
  name: string
  query: string
  filters?: Record<string, unknown>
}

export async function createSavedSearch(
  userId: string,
  tier: UserTier,
  input: CreateSavedSearchInput
) {
  const limit = MAX_SAVED_SEARCHES[tier]

  if (limit !== Infinity) {
    const count = await prisma.savedSearch.count({ where: { userId } })
    if (count >= limit) {
      throw new Error(
        `Saved search limit reached (${limit}). Upgrade your plan for more.`
      )
    }
  }

  return prisma.savedSearch.create({
    data: {
      userId,
      name: input.name,
      query: input.query,
      filters: input.filters
        ? JSON.parse(JSON.stringify(input.filters))
        : undefined,
    },
  })
}

export async function getSavedSearches(userId: string) {
  return prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function deleteSavedSearch(userId: string, searchId: string) {
  const saved = await prisma.savedSearch.findUnique({
    where: { id: searchId },
    select: { userId: true },
  })

  if (!saved || saved.userId !== userId) {
    throw new Error('Saved search not found')
  }

  return prisma.savedSearch.delete({ where: { id: searchId } })
}

export async function toggleAlert(
  userId: string,
  searchId: string,
  enabled: boolean
) {
  const saved = await prisma.savedSearch.findUnique({
    where: { id: searchId },
    select: { userId: true },
  })

  if (!saved || saved.userId !== userId) {
    throw new Error('Saved search not found')
  }

  return prisma.savedSearch.update({
    where: { id: searchId },
    data: { alertEnabled: enabled },
  })
}
