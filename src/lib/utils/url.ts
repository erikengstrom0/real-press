/**
 * URL Normalization and Validation Utilities
 *
 * Handles flexible URL input from users:
 * - "google.com" → "https://google.com"
 * - "www.google.com" → "https://www.google.com"
 * - "http://example.com" → "http://example.com" (preserved)
 */

export interface NormalizeResult {
  success: true
  url: string
  wasModified: boolean
}

export interface NormalizeError {
  success: false
  error: string
  hint: string
}

export type NormalizeUrlResult = NormalizeResult | NormalizeError

// Pattern to detect if input looks like a domain (has a dot and valid TLD-like ending)
const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(\/.*)?$/

// Dangerous protocols we should block
const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:']

/**
 * Normalizes user input into a valid URL.
 * Adds https:// if no protocol is specified.
 */
export function normalizeUrl(input: string): NormalizeUrlResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return {
      success: false,
      error: 'Please enter a URL',
      hint: 'Try something like "example.com" or "https://example.com/page"',
    }
  }

  // Block dangerous protocols
  const lowerInput = trimmed.toLowerCase()
  for (const protocol of BLOCKED_PROTOCOLS) {
    if (lowerInput.startsWith(protocol)) {
      return {
        success: false,
        error: 'Invalid URL protocol',
        hint: 'Please enter a web URL starting with http:// or https://',
      }
    }
  }

  // If it already has a protocol, validate it directly
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      // Ensure it has a valid hostname
      if (!url.hostname || !url.hostname.includes('.')) {
        return {
          success: false,
          error: 'Invalid domain name',
          hint: 'The URL must have a valid domain like "example.com"',
        }
      }
      return { success: true, url: trimmed, wasModified: false }
    } catch {
      return {
        success: false,
        error: 'Invalid URL format',
        hint: 'Please check the URL and try again',
      }
    }
  }

  // Check if it looks like a domain without protocol
  if (DOMAIN_PATTERN.test(trimmed)) {
    const urlWithProtocol = `https://${trimmed}`
    try {
      new URL(urlWithProtocol) // Validate it's parseable
      return { success: true, url: urlWithProtocol, wasModified: true }
    } catch {
      return {
        success: false,
        error: 'Invalid URL format',
        hint: 'Please enter a valid URL like "example.com"',
      }
    }
  }

  // Doesn't match any valid pattern
  return {
    success: false,
    error: 'This doesn\'t look like a valid URL',
    hint: 'Try entering a domain like "example.com" or a full URL like "https://example.com/page"',
  }
}

/**
 * Simple check if a string could be normalized into a valid URL.
 * Use normalizeUrl() for the actual normalized value.
 */
export function canBeNormalized(input: string): boolean {
  return normalizeUrl(input).success
}

/**
 * Get just the normalized URL string, or null if invalid.
 */
export function getNormalizedUrl(input: string): string | null {
  const result = normalizeUrl(input)
  return result.success ? result.url : null
}
