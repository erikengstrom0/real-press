/**
 * User API Key Management
 *
 * GET  — list all API keys for the authenticated user
 * POST — create a new API key
 * DELETE — revoke an API key by id
 *
 * Session auth only (no API key auth for key management).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/services/api-key.service'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
})

const deleteSchema = z.object({
  keyId: z.string().min(1, 'Key ID is required'),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const keys = await listApiKeys(session.user.id)
  return NextResponse.json({ keys })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const result = await createApiKey(session.user.id, parsed.data.name)
  return NextResponse.json(result, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const result = await revokeApiKey(session.user.id, parsed.data.keyId)
  if (!result) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}
