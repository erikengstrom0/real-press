/**
 * Rate Limiting Utility
 *
 * Uses Upstash Redis for distributed rate limiting across Vercel instances.
 * Gracefully degrades when Upstash is not configured (dev mode).
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

type EndpointKey =
  | 'submit'
  | 'analyze'
  | 'search'
  | 'verify-text'
  | 'verify-url'
  | 'verify-image'
  | 'verify-batch'
  | 'register'

// Limits per endpoint (requests per sliding window)
const LIMITS: Record<EndpointKey, { requests: number; window: `${number} s` | `${number} m` }> = {
  submit: { requests: 10, window: '1 m' },
  analyze: { requests: 20, window: '1 m' },
  search: { requests: 60, window: '1 m' },
  'verify-text': { requests: 30, window: '1 m' },
  'verify-url': { requests: 10, window: '1 m' },
  'verify-image': { requests: 10, window: '1 m' },
  'verify-batch': { requests: 5, window: '1 m' },
  register: { requests: 5, window: '1 m' },
}

// Lazy-initialized limiters (one per endpoint)
const limiters: Partial<Record<EndpointKey, Ratelimit>> = {}

function getLimiter(endpoint: EndpointKey): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  if (!limiters[endpoint]) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })

    const config = LIMITS[endpoint]
    limiters[endpoint] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      prefix: `ratelimit:${endpoint}`,
    })
  }

  return limiters[endpoint]!
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'anonymous'
}

/**
 * Check rate limit for a request. Returns a 429 response if limited, or null if allowed.
 */
export async function checkRateLimit(
  request: NextRequest,
  endpoint: EndpointKey
): Promise<NextResponse | null> {
  const limiter = getLimiter(endpoint)
  if (!limiter) {
    // Upstash not configured — allow all requests (dev mode)
    return null
  }

  const ip = getClientIp(request)

  try {
    const result = await limiter.limit(ip)

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(retryAfter, 1)),
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.reset),
          },
        }
      )
    }

    return null
  } catch (error) {
    // If Redis is down, allow the request through rather than blocking everyone
    console.error('Rate limit check failed:', error)
    return null
  }
}
