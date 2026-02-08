/**
 * Monthly Quota Configuration
 *
 * Defines per-tier monthly request limits for the verification API.
 */

import type { UserTier } from '@/lib/api/check-tier'

export const MONTHLY_QUOTAS: Record<UserTier, number> = {
  free: 100,
  pro: 5_000,
  enterprise: 50_000,
}

export interface QuotaStatus {
  tier: UserTier
  used: number
  limit: number
  remaining: number
  resetsAt: string // ISO date, first of next month
  percentUsed: number
}
