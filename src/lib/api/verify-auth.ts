/**
 * Dual Authentication for Public Verification API
 *
 * Checks Bearer token first (API key), falls back to NextAuth session.
 * Used by /api/v1/verify/* endpoints.
 */

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { validateApiKey } from '@/lib/services/api-key.service'
import { getUserTier, type UserTier } from '@/lib/api/check-tier'
import { recordUsage } from '@/lib/services/usage.service'

export interface VerifyAuthResult {
  userId: string
  tier: UserTier
  authMethod: 'session' | 'api_key'
  apiKeyId: string | null
}

export interface VerifyAuthError {
  error: string
  status: 401 | 403
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
 * 3. Returns user info on success, or an error object on failure.
 */
export async function verifyAuth(
  request: NextRequest
): Promise<VerifyAuthResult | VerifyAuthError> {
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

      const tier = tierMap[result.tier] ?? 'free'
      const endpoint = extractEndpointKey(request.nextUrl.pathname)

      // Fire-and-forget usage tracking
      recordUsage(result.userId, result.apiKeyId, endpoint)

      return { userId: result.userId, tier, authMethod: 'api_key', apiKeyId: result.apiKeyId }
    }

    // Non-API-key Bearer tokens are invalid for this endpoint
    return { error: 'Invalid authorization token', status: 401 }
  }

  // Fall back to NextAuth session
  const session = await auth()

  if (!session?.user?.id) {
    return {
      error: 'Authentication required. Provide an API key via Authorization header or sign in.',
      status: 401,
    }
  }

  const tier = await getUserTier(session.user.id)
  const endpoint = extractEndpointKey(request.nextUrl.pathname)

  // Fire-and-forget usage tracking
  recordUsage(session.user.id, null, endpoint)

  return { userId: session.user.id, tier, authMethod: 'session', apiKeyId: null }
}

/**
 * Type guard to check if the auth result is an error.
 */
export function isAuthError(
  result: VerifyAuthResult | VerifyAuthError
): result is VerifyAuthError {
  return 'error' in result
}
