/**
 * URL Redirect Resolver
 *
 * Follows HTTP redirects with a configurable hop limit to
 * resolve the final destination URL. Each hop is validated
 * against SSRF protection and the domain blocklist.
 */

import { validateUrlForFetch } from '@/lib/utils/ssrf-protection'
import { isDomainBlocked } from './domain-blocklist'

const DEFAULT_MAX_HOPS = 5
const RESOLVE_TIMEOUT_MS = 10_000

export interface ResolveResult {
  finalUrl: string
  hops: number
  safe: boolean
  error?: string
}

/**
 * Follow redirects up to `maxHops`, validating each hop
 * against SSRF and domain blocklist rules.
 */
export async function resolveUrl(
  url: string,
  maxHops: number = DEFAULT_MAX_HOPS
): Promise<ResolveResult> {
  let currentUrl = url
  let hops = 0

  while (hops < maxHops) {
    // SSRF check on current URL
    const ssrfResult = await validateUrlForFetch(currentUrl)
    if (!ssrfResult.safe) {
      return {
        finalUrl: currentUrl,
        hops,
        safe: false,
        error: `Redirect hop ${hops} blocked: ${ssrfResult.error}`,
      }
    }

    // Blocklist check on current URL
    const blockResult = await isDomainBlocked(currentUrl)
    if (blockResult.blocked) {
      return {
        finalUrl: currentUrl,
        hops,
        safe: false,
        error: `Redirect hop ${hops} blocked: ${blockResult.reason}`,
      }
    }

    // Follow redirect (HEAD request to avoid downloading body)
    let response: Response
    try {
      response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
      })
    } catch (error) {
      // Network error — treat as non-redirect, return current URL as final
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        return {
          finalUrl: currentUrl,
          hops,
          safe: false,
          error: 'URL resolution timed out',
        }
      }
      // Other fetch errors — assume no redirect, URL is the final destination
      return { finalUrl: currentUrl, hops, safe: true }
    }

    // Check for redirect status codes
    const isRedirect =
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has('location')

    if (!isRedirect) {
      // No more redirects — currentUrl is the final destination
      return { finalUrl: currentUrl, hops, safe: true }
    }

    // Resolve relative redirect location against current URL
    const location = response.headers.get('location')!
    try {
      currentUrl = new URL(location, currentUrl).href
    } catch {
      return {
        finalUrl: currentUrl,
        hops,
        safe: false,
        error: `Invalid redirect location: ${location}`,
      }
    }

    hops++
  }

  // Exceeded hop limit
  return {
    finalUrl: currentUrl,
    hops,
    safe: false,
    error: `Exceeded maximum redirect hops (${maxHops})`,
  }
}
