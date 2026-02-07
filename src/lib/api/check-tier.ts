import prisma from '@/lib/db/prisma'

export type UserTier = 'free' | 'pro' | 'enterprise'

const tierMap: Record<string, UserTier> = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
}

/**
 * Get the subscription tier for a user by querying the database.
 * Returns 'free' if the user is not found.
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    })

    if (!user) return 'free'
    return tierMap[user.tier] ?? 'free'
  } catch {
    return 'free'
  }
}

/**
 * Check whether a tier has access to the full explainability breakdown.
 * Only 'pro' and 'enterprise' tiers can see the detailed breakdown.
 */
export function hasBreakdownAccess(tier: UserTier): boolean {
  return tier === 'pro' || tier === 'enterprise'
}
