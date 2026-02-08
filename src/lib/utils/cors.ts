/**
 * CORS utility for API endpoints
 *
 * Provides CORS headers for cross-origin requests to the verification API.
 * Allows all origins for public API access.
 */

export interface CorsHeaders {
  'Access-Control-Allow-Origin': string
  'Access-Control-Allow-Methods': string
  'Access-Control-Allow-Headers': string
  'Access-Control-Max-Age'?: string
}

/**
 * Get CORS headers for API responses
 *
 * @param origin - Optional origin header from request (defaults to '*')
 * @returns Headers object with CORS configuration
 */
export function getCorsHeaders(origin?: string | null): CorsHeaders {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
}

/**
 * Handle OPTIONS preflight requests
 *
 * @param request - The incoming request
 * @returns Response with CORS headers for preflight
 */
export function handleCorsPreFlight(request: Request): Response {
  const origin = request.headers.get('origin')
  const headers = getCorsHeaders(origin)

  return new Response(null, {
    status: 204,
    headers,
  })
}
