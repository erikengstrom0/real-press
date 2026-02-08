/**
 * POST /api/auth/resend-verification
 *
 * Resends the verification email for a user who hasn't verified their email yet.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import {
  generateVerificationToken,
  getVerificationTokenExpiry,
  sendVerificationEmail,
} from '@/lib/services/email.service'
import { checkRateLimit } from '@/lib/utils/rate-limit'

const resendSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(request: NextRequest) {
  // Rate limit to prevent abuse
  const rateLimitResponse = await checkRateLimit(request, 'register')
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const body = await request.json()
    const { email } = resendSchema.parse(body)

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Don't reveal whether email exists (security best practice)
      return NextResponse.json(
        { message: 'If that email is registered, a verification email has been sent.' },
        { status: 200 }
      )
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken()
    const verificationTokenExpiry = getVerificationTokenExpiry()

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiry,
      },
    })

    // Send verification email
    await sendVerificationEmail(email, user.name || 'User', verificationToken)

    return NextResponse.json(
      { message: 'Verification email sent. Please check your inbox.' },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    )
  }
}
