/**
 * Domain Blocklist & URL Validation
 *
 * Checks URLs against hardcoded patterns and the dynamic BlockedDomain
 * database table. Detects URL shorteners, suspicious TLDs, and
 * potential injection attempts.
 */

import prisma from '@/lib/db/prisma'

// ── Hardcoded URL shortener domains ──────────────────────────
const URL_SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  'bl.ink',
  'lnkd.in',
  'shorte.st',
  'mcaf.ee',
  'q.gs',
  'po.st',
  'bc.vc',
  'rb.gy',
  's.id',
  'cutt.ly',
  'v.gd',
  'dub.sh',
  'short.io',
  'rebrand.ly',
])

// ── Suspicious/spam TLDs ─────────────────────────────────────
const SUSPICIOUS_TLDS = new Set([
  '.xyz',
  '.top',
  '.buzz',
  '.club',
  '.work',
  '.click',
  '.link',
  '.surf',
  '.gq',
  '.ml',
  '.cf',
  '.ga',
  '.tk',
  '.icu',
  '.monster',
  '.cam',
  '.rest',
  '.hair',
  '.beauty',
  '.quest',
  '.sbs',
])

// ── Hardcoded spam domains ───────────────────────────────────
const HARDCODED_BLOCKED = new Set([
  'example-spam.com',
  // Add known spam domains as they're discovered
])

const MAX_URL_LENGTH = 2048

export interface BlockCheckResult {
  blocked: boolean
  reason?: string
}

export interface SuspicionResult {
  suspicious: boolean
  reasons: string[]
}

/**
 * Check if a domain is blocked (hardcoded list + database).
 */
export async function isDomainBlocked(url: string): Promise<BlockCheckResult> {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return { blocked: true, reason: 'Invalid URL format' }
  }

  // Check hardcoded blocked domains
  if (HARDCODED_BLOCKED.has(hostname)) {
    return { blocked: true, reason: 'Domain is on the blocklist' }
  }

  // Check dynamic blocklist in database
  try {
    const blockedDomains = await prisma.blockedDomain.findMany({
      select: { pattern: true, reason: true },
    })

    for (const entry of blockedDomains) {
      if (domainMatchesPattern(hostname, entry.pattern)) {
        return {
          blocked: true,
          reason: entry.reason || 'Domain is on the blocklist',
        }
      }
    }
  } catch (error) {
    // Database error — fail open (don't block legitimate users)
    console.error('Blocklist DB check failed:', error)
  }

  return { blocked: false }
}

/**
 * Check if a URL is a known URL shortener.
 */
export function isUrlShortener(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return URL_SHORTENERS.has(hostname)
  } catch {
    return false
  }
}

/**
 * Run multiple heuristic checks on a URL for suspicious signals.
 */
export function isSuspiciousUrl(url: string): SuspicionResult {
  const reasons: string[] = []

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { suspicious: true, reasons: ['Invalid URL format'] }
  }

  const hostname = parsed.hostname.toLowerCase()

  // URL shortener
  if (URL_SHORTENERS.has(hostname)) {
    reasons.push('URL shortener detected')
  }

  // Suspicious TLD
  const tld = hostname.slice(hostname.lastIndexOf('.'))
  if (SUSPICIOUS_TLDS.has(tld)) {
    reasons.push(`Suspicious TLD: ${tld}`)
  }

  // Excessively long URL
  if (url.length > MAX_URL_LENGTH) {
    reasons.push(`URL exceeds ${MAX_URL_LENGTH} characters`)
  }

  // Encoded characters suggesting injection
  const encodedCount = (url.match(/%[0-9A-Fa-f]{2}/g) || []).length
  if (encodedCount > 10) {
    reasons.push('Excessive URL encoding (possible injection)')
  }

  // Multiple query parameters that look like injection
  if (parsed.search.length > 500) {
    reasons.push('Excessively long query string')
  }

  // Hostname with many subdomains (often spam)
  const subdomainCount = hostname.split('.').length - 2
  if (subdomainCount > 3) {
    reasons.push('Unusually deep subdomain nesting')
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  }
}

/**
 * Match a hostname against a blocklist pattern.
 * Supports exact match and wildcard prefix (*.example.com).
 */
function domainMatchesPattern(hostname: string, pattern: string): boolean {
  // Exact match
  if (hostname === pattern) return true

  // Wildcard: *.example.com matches sub.example.com
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2)
    return hostname.endsWith(`.${suffix}`) || hostname === suffix
  }

  // Suffix match: pattern "example.com" matches "sub.example.com"
  return hostname.endsWith(`.${pattern}`)
}
