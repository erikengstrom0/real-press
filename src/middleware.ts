import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to protect admin routes
 *
 * Admin routes require either:
 * 1. Authorization header: Bearer <ADMIN_SECRET>
 * 2. Cookie: admin_token=<ADMIN_SECRET> (set by /api/admin/auth)
 *
 * NextAuth routes (/api/auth/*) are publicly accessible.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // NextAuth routes must be publicly accessible
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Only protect admin routes (except login page and auth endpoint)
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return NextResponse.next()
  }

  // Allow access to login page and auth endpoint without authentication
  if (pathname === '/admin/login' || pathname === '/api/admin/auth') {
    return NextResponse.next()
  }

  // Allow the cron worker endpoint if it has the CRON_SECRET
  if (pathname === '/api/admin/crawl/worker') {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return NextResponse.next()
    }
  }

  const adminSecret = process.env.ADMIN_SECRET

  // If no admin secret is configured, block all admin access in production
  if (!adminSecret) {
    // Allow in development
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.next()
    }
    return new NextResponse('Admin access not configured', { status: 503 })
  }

  // Check for valid admin authentication (header or cookie only)
  const authHeader = request.headers.get('authorization')
  const cookieToken = request.cookies.get('admin_token')?.value

  const isAuthenticated =
    authHeader === `Bearer ${adminSecret}` ||
    cookieToken === adminSecret

  if (!isAuthenticated) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // For page routes, redirect to login
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/auth/:path*',
  ],
}
