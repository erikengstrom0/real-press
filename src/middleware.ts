import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware to protect admin routes
 *
 * Admin routes require either:
 * 1. Authorization header: Bearer <ADMIN_SECRET>
 * 2. Cookie: admin_token=<ADMIN_SECRET>
 * 3. Query param: ?admin_token=<ADMIN_SECRET> (for initial login)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect admin routes
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
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

  // Check for valid admin authentication
  const authHeader = request.headers.get('authorization')
  const cookieToken = request.cookies.get('admin_token')?.value
  const queryToken = request.nextUrl.searchParams.get('admin_token')

  const isAuthenticated =
    authHeader === `Bearer ${adminSecret}` ||
    cookieToken === adminSecret ||
    queryToken === adminSecret

  if (!isAuthenticated) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // For page routes, redirect to a simple login
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If authenticated via query param, set cookie for future requests
  if (queryToken === adminSecret && !cookieToken) {
    const response = NextResponse.next()
    response.cookies.set('admin_token', adminSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
}
