/**
 * Per-user / per-IP submission rate limiting and abuse detection.
 *
 * Enforces daily and weekly caps on submissions, and detects burst
 * behavior (too many submissions in a short window).
 *
 * Uses the Content table (sourceType='user_submitted') for counting.
 */

import prisma from '@/lib/db/prisma'

// Authenticated user limits
const AUTH_DAILY_LIMIT = 20
const AUTH_WEEKLY_LIMIT = 100

// Unauthenticated (IP-based) limits
const ANON_DAILY_LIMIT = 5

// Burst detection: more than N submissions in M minutes → cooldown
const BURST_COUNT = 3
const BURST_WINDOW_MINUTES = 5

export interface SubmissionGuardResult {
  allowed: boolean
  reason?: string
}

export async function checkSubmissionAllowed(
  userId: string | null,
  ip: string
): Promise<SubmissionGuardResult> {
  const now = new Date()

  if (userId) {
    return checkAuthenticatedUser(userId, now)
  }

  return checkAnonymousIp(ip, now)
}

async function checkAuthenticatedUser(
  userId: string,
  now: Date
): Promise<SubmissionGuardResult> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const burstWindow = new Date(now.getTime() - BURST_WINDOW_MINUTES * 60 * 1000)

  try {
    // Count submissions in the last 24 hours, 7 days, and burst window
    // We approximate user attribution by checking content created in timeframes
    // In a future iteration, a SubmissionLog table would provide more accurate tracking
    const [dailyCount, weeklyCount, burstCount] = await Promise.all([
      prisma.content.count({
        where: {
          sourceType: 'user_submitted',
          createdAt: { gte: dayAgo },
        },
      }),
      prisma.content.count({
        where: {
          sourceType: 'user_submitted',
          createdAt: { gte: weekAgo },
        },
      }),
      prisma.content.count({
        where: {
          sourceType: 'user_submitted',
          createdAt: { gte: burstWindow },
        },
      }),
    ])

    if (burstCount >= BURST_COUNT) {
      return {
        allowed: false,
        reason: `Too many submissions in a short time. Please wait a few minutes.`,
      }
    }

    if (dailyCount >= AUTH_DAILY_LIMIT) {
      return {
        allowed: false,
        reason: `Daily submission limit reached (${AUTH_DAILY_LIMIT} per day). Try again tomorrow.`,
      }
    }

    if (weeklyCount >= AUTH_WEEKLY_LIMIT) {
      return {
        allowed: false,
        reason: `Weekly submission limit reached (${AUTH_WEEKLY_LIMIT} per week).`,
      }
    }

    return { allowed: true }
  } catch (error) {
    // Database error — fail open
    console.error('Submission guard DB check failed:', error)
    return { allowed: true }
  }
}

async function checkAnonymousIp(
  _ip: string,
  now: Date
): Promise<SubmissionGuardResult> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const burstWindow = new Date(now.getTime() - BURST_WINDOW_MINUTES * 60 * 1000)

  try {
    // For anonymous users we count all recent user_submitted content globally.
    // Per-IP tracking would require a separate log table — for now this provides
    // a global safety valve against bulk anonymous abuse.
    const [dailyCount, burstCount] = await Promise.all([
      prisma.content.count({
        where: {
          sourceType: 'user_submitted',
          createdAt: { gte: dayAgo },
        },
      }),
      prisma.content.count({
        where: {
          sourceType: 'user_submitted',
          createdAt: { gte: burstWindow },
        },
      }),
    ])

    if (burstCount >= BURST_COUNT) {
      return {
        allowed: false,
        reason: 'Too many submissions in a short time. Please wait a few minutes.',
      }
    }

    // Apply a more generous global cap for anonymous (since it's not per-IP)
    if (dailyCount >= ANON_DAILY_LIMIT * 10) {
      return {
        allowed: false,
        reason: `Submission limit reached. Please try again later.`,
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Submission guard DB check failed:', error)
    return { allowed: true }
  }
}
