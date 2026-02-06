import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * POST /api/admin/auth
 *
 * Validates admin token and sets a secure httpOnly cookie.
 * This endpoint is excluded from middleware auth checks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body as { token?: string }

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const adminSecret = process.env.ADMIN_SECRET

    if (!adminSecret) {
      if (process.env.NODE_ENV === 'development') {
        // Dev mode: accept any token
        const response = NextResponse.json({ success: true })
        response.cookies.set('admin_token', token, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        })
        return response
      }
      return NextResponse.json({ error: 'Admin not configured' }, { status: 503 })
    }

    // Timing-safe comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(token)
    const secretBuffer = Buffer.from(adminSecret)

    const isValid =
      tokenBuffer.length === secretBuffer.length &&
      timingSafeEqual(tokenBuffer, secretBuffer)

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_token', adminSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
