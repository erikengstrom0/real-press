/**
 * Admin Blocklist Management API
 *
 * GET    /api/admin/blocklist — List all blocked domains
 * POST   /api/admin/blocklist — Add a domain pattern
 * DELETE /api/admin/blocklist — Remove a domain pattern
 *
 * Protected by admin middleware (ADMIN_SECRET).
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET() {
  const domains = await prisma.blockedDomain.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ domains })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { domain, reason } = body as { domain?: string; reason?: string }

  if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
    return NextResponse.json(
      { error: 'domain is required and must be a non-empty string' },
      { status: 400 }
    )
  }

  const pattern = domain.trim().toLowerCase()

  // Check for duplicate
  const existing = await prisma.blockedDomain.findUnique({
    where: { pattern },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'Domain pattern already exists', existing },
      { status: 409 }
    )
  }

  const created = await prisma.blockedDomain.create({
    data: {
      pattern,
      reason: reason || null,
    },
  })

  return NextResponse.json({ domain: created }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { domain } = body as { domain?: string }

  if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
    return NextResponse.json(
      { error: 'domain is required and must be a non-empty string' },
      { status: 400 }
    )
  }

  const pattern = domain.trim().toLowerCase()

  try {
    await prisma.blockedDomain.delete({
      where: { pattern },
    })
  } catch {
    return NextResponse.json(
      { error: 'Domain pattern not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ removed: pattern })
}
