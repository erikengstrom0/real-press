/**
 * User Tier Check Utility
 *
 * Determines a user's subscription tier for API response gating.
 * Pure utility functions — no database calls, no side effects.
 */

export type UserTier = 'free' | 'pro' | 'enterprise'

/**
 * Get the subscription tier for a user.
 *
 * TODO: This is a stub that always returns 'free'. Once Phase 2 (Billing)
 * is implemented, this should query the User's subscription tier from
 * the database (e.g., via the Subscription model or Stripe metadata).
 * The lookup should be cached alongside the API key validation cache
 * to avoid adding latency to every request.
 *
 * @param _userIdOrApiKeyHash - User ID or hashed API key
 * @returns The user's subscription tier
 */
export function getUserTier(_userIdOrApiKeyHash: string): UserTier {
  // TODO: Replace with actual tier lookup when Phase 2 (Billing) is implemented.
  // Expected implementation:
  //   1. Look up user by ID or API key hash
  //   2. Check their active subscription (Stripe, etc.)
  //   3. Map subscription plan to tier ('free' | 'pro' | 'enterprise')
  //   4. Cache the result for the TTL of the API key cache
  return 'free'
}

/**
 * Check whether a tier has access to the full explainability breakdown.
 * Only 'pro' and 'enterprise' tiers can see the detailed breakdown.
 */
export function hasBreakdownAccess(tier: UserTier): boolean {
  return tier === 'pro' || tier === 'enterprise'
}
