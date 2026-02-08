/**
 * Dual Authentication for Public Verification API
 *
 * Checks Bearer token first (API key), falls back to NextAuth session.
 * Used by /api/v1/verify/* endpoints.
 * Includes monthly quota enforcement after authentication.
 */

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { validateApiKey } from '@/lib/services/api-key.service'
import { getUserTier, type UserTier } from '@/lib/api/check-tier'
import { checkQuota } from '@/lib/services/quota.service'
import type { QuotaStatus } from '@/lib/config/quotas'

export type { QuotaStatus }

export interface VerifyAuthResult {
  userId: string
  tier: UserTier
  authMethod: 'session' | 'api_key'
  apiKeyId: string | null
  quotaStatus: QuotaStatus
}

export interface VerifyAuthError {
  error: string
  status: 401 | 403 | 429
  quotaStatus?: QuotaStatus
}

const tierMap: Record<string, UserTier> = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
}

/**
 * Extract endpoint key from pathname.
 * e.g. /api/v1/verify/text -> 'verify-text'
 */
function extractEndpointKey(pathname: string): string {
  const match = pathname.match(/\/api\/v1\/verify\/(\w+)/)
  return match ? `verify-${match[1]}` : 'unknown'
}

/**
 * Authenticate a verification API request.
 *
 * 1. If Authorization: Bearer <token> is present, validate as API key.
 * 2. Otherwise, fall back to NextAuth session cookie.
 * 3. After authentication, checks monthly quota.
 * 4. Returns user info on success, or an error object on failure.
 */
export async function verifyAuth(
  request: NextRequest
): Promise<VerifyAuthResult | VerifyAuthError> {
  let userId: string
  let tier: UserTier
  let authMethod: 'session' | 'api_key'
  let apiKeyId: string | null = null

  // Check for Bearer token (API key)
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)

    // Only treat rp_live_ prefixed tokens as API keys
    if (token.startsWith('rp_live_')) {
      const result = await validateApiKey(token)

      if (!result) {
        return { error: 'Invalid or revoked API key', status: 401 }
      }

      tier = tierMap[result.tier] ?? 'free'
      userId = result.userId
      authMethod = 'api_key'
      apiKeyId = result.apiKeyId
    } else {
      // Non-API-key Bearer tokens are invalid for this endpoint
      return { error: 'Invalid authorization token', status: 401 }
    }
  } else {
    // Fall back to NextAuth session
    const session = await auth()

    if (!session?.user?.id) {
      return {
        error: 'Authentication required. Provide an API key via Authorization header or sign in.',
        status: 401,
      }
    }

    userId = session.user.id
    tier = await getUserTier(userId)
    authMethod = 'session'
  }

  // Check monthly quota
  const quotaResult = await checkQuota(userId, tier)
  if (!quotaResult.allowed) {
    return {
      error: 'Monthly API quota exceeded. Upgrade your plan for more requests.',
      status: 429,
      quotaStatus: quotaResult.status,
    }
  }

  return { userId, tier, authMethod, apiKeyId, quotaStatus: quotaResult.status }
}

/**
 * Type guard to check if the auth result is an error.
 */
export function isAuthError(
  result: VerifyAuthResult | VerifyAuthError
): result is VerifyAuthError {
  return 'error' in result
}

/**
 * Build X-Quota-* response headers from a QuotaStatus.
 */
export function quotaHeaders(status: QuotaStatus): Record<string, string> {
  return {
    'X-Quota-Limit': String(status.limit),
    'X-Quota-Remaining': String(status.remaining),
    'X-Quota-Used': String(status.used),
    'X-Quota-Reset': status.resetsAt,
  }
}
