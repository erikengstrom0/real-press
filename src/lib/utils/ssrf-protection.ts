/**
 * SSRF Protection Utility
 *
 * Validates URLs before server-side fetching to prevent
 * Server-Side Request Forgery attacks targeting internal networks,
 * cloud metadata endpoints, and localhost services.
 */

import dns from 'dns/promises'

/**
 * Check if an IPv4 address is in a private/reserved range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return false

  const [a, b] = parts

  // 0.0.0.0/8 — current network
  if (a === 0) return true
  // 10.0.0.0/8 — private
  if (a === 10) return true
  // 127.0.0.0/8 — loopback
  if (a === 127) return true
  // 169.254.0.0/16 — link-local / cloud metadata
  if (a === 169 && b === 254) return true
  // 172.16.0.0/12 — private
  if (a === 172 && b >= 16 && b <= 31) return true
  // 192.168.0.0/16 — private
  if (a === 192 && b === 168) return true

  return false
}

/**
 * Check if an IPv6 address is private/reserved.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase()

  // ::1 — loopback
  if (normalized === '::1') return true
  // :: — unspecified
  if (normalized === '::') return true
  // fc00::/7 — unique local address
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  // fe80::/10 — link-local
  if (normalized.startsWith('fe80')) return true

  return false
}

export interface SsrfValidationResult {
  safe: boolean
  error?: string
}

/**
 * Validate that a URL is safe to fetch server-side.
 * Resolves the hostname to an IP and checks against blocked ranges.
 */
export async function validateUrlForFetch(url: string): Promise<SsrfValidationResult> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { safe: false, error: 'Invalid URL format' }
  }

  // Only allow http/https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, error: 'Only HTTP and HTTPS URLs are allowed' }
  }

  const hostname = parsed.hostname

  // Block IP literals directly
  if (isPrivateIPv4(hostname)) {
    return { safe: false, error: 'URLs pointing to private networks are not allowed' }
  }
  if (isPrivateIPv6(hostname) || hostname === '[::1]') {
    return { safe: false, error: 'URLs pointing to private networks are not allowed' }
  }

  // Resolve hostname to IP and check
  try {
    const { address, family } = await dns.lookup(hostname)

    if (family === 4 && isPrivateIPv4(address)) {
      return { safe: false, error: 'This URL resolves to a private network address' }
    }
    if (family === 6 && isPrivateIPv6(address)) {
      return { safe: false, error: 'This URL resolves to a private network address' }
    }
  } catch {
    // DNS resolution failed — let the actual fetch handle the error
    // (could be a temporary DNS issue, or the domain doesn't exist)
  }

  return { safe: true }
}
