/**
 * Post-extraction content quality checks.
 *
 * Validates extracted content to reject low-quality, non-article,
 * or potentially malicious submissions.
 */

const MIN_TEXT_LENGTH = 200
const MAX_TEXT_LENGTH = 500_000

// Patterns indicating login/paywall/consent pages rather than articles
const GATE_PATTERNS = [
  /sign\s*in\s*to\s*(continue|access|view|read)/i,
  /log\s*in\s*to\s*(continue|access|view|read)/i,
  /create\s*an?\s*account\s*to/i,
  /subscribe\s*to\s*(continue|unlock|access|read)/i,
  /this\s*content\s*is\s*(available|accessible)\s*(only|exclusively)\s*(to|for)\s*(subscribers|members|premium)/i,
  /you('ve|'ve|\s+have)\s*reached\s*(your|the)\s*(free\s*)?article\s*limit/i,
  /we\s*use\s*cookies[\s\S]*accept/i,
  /cookie\s*(policy|consent|preferences)/i,
  /accept\s*(all\s*)?cookies/i,
  /manage\s*your\s*(cookie|consent)\s*(preferences|settings)/i,
]

// Patterns indicating auto-generated index/listing pages
const INDEX_PATTERNS = [
  /^(index\s*of|directory\s*listing)/i,
  /^(sitemap|site\s*map)/i,
  /^(archive|archives)\s*(for|of|\||-)/i,
  /^(category|tag|tags):/i,
]

// Non-text content indicators
const NON_TEXT_PATTERNS = [
  /^(\s*<[^>]+>\s*)+$/, // Only HTML tags, no text
  /^[\s\d.,;:!?'"()\-/\\@#$%^&*+=[\]{}|~`]+$/, // Only whitespace, numbers, punctuation
]

export interface ContentValidationInput {
  text: string
  url: string
  domain: string
}

export interface ContentValidationResult {
  valid: boolean
  reasons: string[]
}

export function validateContent(content: ContentValidationInput): ContentValidationResult {
  const reasons: string[] = []

  // Minimum meaningful text length
  const trimmed = content.text.trim()
  if (trimmed.length < MIN_TEXT_LENGTH) {
    reasons.push(
      `Content too short (${trimmed.length} characters, minimum ${MIN_TEXT_LENGTH})`
    )
  }

  // Maximum text length (prevent memory abuse)
  if (trimmed.length > MAX_TEXT_LENGTH) {
    reasons.push(
      `Content too long (${trimmed.length} characters, maximum ${MAX_TEXT_LENGTH.toLocaleString()})`
    )
  }

  // Check for login/paywall/cookie-consent pages
  for (const pattern of GATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push('Page appears to be a login, paywall, or cookie consent page')
      break
    }
  }

  // Check title/first line for index/listing patterns
  const firstLine = trimmed.split('\n')[0] || ''
  for (const pattern of INDEX_PATTERNS) {
    if (pattern.test(firstLine)) {
      reasons.push('Page appears to be an auto-generated index or listing page')
      break
    }
  }

  // Check for non-text content
  for (const pattern of NON_TEXT_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push('Content does not appear to contain meaningful text')
      break
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  }
}
