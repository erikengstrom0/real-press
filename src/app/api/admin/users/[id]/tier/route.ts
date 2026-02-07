/**
 * PATCH /api/admin/users/[id]/tier
 *
 * Admin endpoint to set a user's subscription tier.
 * Protected by middleware ADMIN_SECRET authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'

const patchSchema = z.object({
  tier: z.enum(['FREE', 'PRO', 'ENTERPRISE']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { tier: parsed.data.tier },
    select: {
      id: true,
      email: true,
      name: true,
      tier: true,
    },
  })

  return NextResponse.json(updated)
}
