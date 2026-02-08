/**
 * Error Sanitizer Utility
 *
 * Prevents information leakage by sanitizing error messages for public-facing responses.
 * Detailed errors are logged internally, while users receive generic, safe messages.
 */

export interface SanitizedError {
  /** Safe error message for public consumption */
  publicMessage: string
  /** HTTP status code */
  status: number
  /** Detailed error for internal logging (never exposed to client) */
  internalDetails?: string
  /** Error category for monitoring */
  category?: 'validation' | 'extraction' | 'detection' | 'database' | 'external_api' | 'unknown'
}

/**
 * Sanitize an error for public API responses.
 * Returns a safe message for the user and logs detailed information internally.
 */
export function sanitizeError(
  error: unknown,
  context?: string
): SanitizedError {
  // Already a SanitizedError - return as-is
  if (isSanitizedError(error)) {
    return error
  }

  // Extract error details for logging
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined
  const internalDetails = `${context ? `[${context}] ` : ''}${errorMessage}`

  // Log detailed error internally (production logs capture this)
  console.error('Error details:', {
    context,
    message: errorMessage,
    stack: errorStack,
    type: error instanceof Error ? error.constructor.name : typeof error,
  })

  // Default safe error response
  let publicMessage = 'An unexpected error occurred. Please try again.'
  let status = 500
  let category: SanitizedError['category'] = 'unknown'

  // Categorize error type and provide appropriate public message
  if (error instanceof Error) {
    const name = error.constructor.name

    switch (name) {
      case 'ExtractionError':
        publicMessage = 'Failed to extract content. Please verify the URL is accessible.'
        status = 422
        category = 'extraction'
        break

      case 'ValidationError':
      case 'ZodError':
        publicMessage = 'Invalid request data. Please check your input.'
        status = 400
        category = 'validation'
        break

      case 'PrismaClientKnownRequestError':
      case 'PrismaClientValidationError':
        publicMessage = 'A database error occurred. Please try again.'
        status = 500
        category = 'database'
        break

      case 'TypeError':
      case 'ReferenceError':
      case 'SyntaxError':
        // Internal programming errors - never expose details
        publicMessage = 'An internal error occurred. Our team has been notified.'
        status = 500
        category = 'unknown'
        break

      default:
        // Check error message for known patterns (but don't expose them)
        if (isNetworkError(errorMessage)) {
          publicMessage = 'Network error. Please check the URL and try again.'
          status = 502
          category = 'external_api'
        } else if (isTimeoutError(errorMessage)) {
          publicMessage = 'Request timed out. Please try again.'
          status = 504
          category = 'external_api'
        } else if (isAuthError(errorMessage)) {
          publicMessage = 'Authentication failed. Please check your credentials.'
          status = 401
          category = 'external_api'
        } else if (isRateLimitError(errorMessage)) {
          publicMessage = 'Rate limit exceeded. Please try again later.'
          status = 429
          category = 'external_api'
        }
        break
    }
  }

  return {
    publicMessage,
    status,
    internalDetails,
    category,
  }
}

/**
 * Type guard for SanitizedError
 */
function isSanitizedError(error: unknown): error is SanitizedError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'publicMessage' in error &&
    'status' in error
  )
}

/**
 * Check if error indicates a network failure
 */
function isNetworkError(message: string): boolean {
  const networkPatterns = [
    'ENOTFOUND',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENETUNREACH',
    'getaddrinfo',
    'fetch failed',
    'network error',
  ]
  return networkPatterns.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()))
}

/**
 * Check if error indicates a timeout
 */
function isTimeoutError(message: string): boolean {
  const timeoutPatterns = [
    'ETIMEDOUT',
    'timeout',
    'timed out',
    'deadline exceeded',
  ]
  return timeoutPatterns.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()))
}

/**
 * Check if error indicates authentication failure
 */
function isAuthError(message: string): boolean {
  const authPatterns = [
    'unauthorized',
    'unauthenticated',
    'authentication failed',
    'invalid credentials',
    'invalid token',
    'invalid api key',
  ]
  return authPatterns.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()))
}

/**
 * Check if error indicates rate limiting
 */
function isRateLimitError(message: string): boolean {
  const rateLimitPatterns = [
    'rate limit',
    'too many requests',
    'throttled',
    '429',
  ]
  return rateLimitPatterns.some((pattern) => message.toLowerCase().includes(pattern.toLowerCase()))
}

/**
 * Create a sanitized error for validation failures.
 * Use this for known user input errors where we want to provide specific guidance.
 */
export function validationError(message: string, details?: string): SanitizedError {
  return {
    publicMessage: message,
    status: 400,
    internalDetails: details,
    category: 'validation',
  }
}

/**
 * Create a sanitized error for extraction failures.
 * Use this when content extraction fails but we want to provide user-friendly feedback.
 */
export function extractionError(message: string, details?: string): SanitizedError {
  return {
    publicMessage: message,
    status: 422,
    internalDetails: details,
    category: 'extraction',
  }
}

/**
 * Create a sanitized error for detection failures.
 * Use this when AI detection fails but we don't want to expose internal details.
 */
export function detectionError(message?: string, details?: string): SanitizedError {
  return {
    publicMessage: message || 'Content analysis failed. Please try again.',
    status: 500,
    internalDetails: details,
    category: 'detection',
  }
}
