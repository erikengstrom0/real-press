import prisma from '@/lib/db/prisma'

export type UserTier = 'free' | 'pro' | 'enterprise'

const tierMap: Record<string, UserTier> = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
}

/**
 * Map a Stripe price ID to a UserTier.
 */
function tierFromPriceId(priceId: string | null): UserTier | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return 'enterprise'
  return null
}

/**
 * Get the subscription tier for a user.
 *
 * Priority:
 * 1. Active Stripe subscription → tier from price ID
 * 2. Past-due subscription → still returns paid tier (grace period)
 * 3. Canceled subscription with time remaining → paid tier until period end
 * 4. Fall back to user.tier enum value (handles admin-set tiers and free users)
 */
export async function getUserTier(userId: string): Promise<UserTier> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tier: true,
        stripeSubscriptionStatus: true,
        stripePriceId: true,
        stripeCurrentPeriodEnd: true,
      },
    })

    if (!user) return 'free'

    // Check Stripe subscription status
    if (user.stripeSubscriptionStatus && user.stripePriceId) {
      const stripeTier = tierFromPriceId(user.stripePriceId)

      if (stripeTier) {
        // Active subscription
        if (user.stripeSubscriptionStatus === 'active') {
          return stripeTier
        }

        // Past due — grace period, still give access
        if (user.stripeSubscriptionStatus === 'past_due') {
          return stripeTier
        }

        // Canceled but still within billing period
        if (
          user.stripeSubscriptionStatus === 'canceled' &&
          user.stripeCurrentPeriodEnd &&
          user.stripeCurrentPeriodEnd > new Date()
        ) {
          return stripeTier
        }
      }
    }

    // Fall back to DB tier enum (admin-set or free)
    return tierMap[user.tier] ?? 'free'
  } catch {
    return 'free'
  }
}

/**
 * Check whether a tier has access to the full explainability breakdown.
 */
export function hasBreakdownAccess(tier: UserTier): boolean {
  return tier === 'pro' || tier === 'enterprise'
}

/**
 * Get detailed subscription status for UI display.
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  tier: UserTier
  status: 'active' | 'past_due' | 'canceled' | 'none'
  currentPeriodEnd: Date | null
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tier: true,
        stripeSubscriptionStatus: true,
        stripePriceId: true,
        stripeCurrentPeriodEnd: true,
      },
    })

    if (!user) {
      return { tier: 'free', status: 'none', currentPeriodEnd: null }
    }

    const tier = await getUserTier(userId)
    const status = (user.stripeSubscriptionStatus as 'active' | 'past_due' | 'canceled') || 'none'

    return {
      tier,
      status,
      currentPeriodEnd: user.stripeCurrentPeriodEnd,
    }
  } catch {
    return { tier: 'free', status: 'none', currentPeriodEnd: null }
  }
}
