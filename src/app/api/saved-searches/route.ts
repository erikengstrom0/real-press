import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getUserTier } from '@/lib/api/check-tier'
import {
  createSavedSearch,
  getSavedSearches,
} from '@/lib/services/saved-search.service'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().min(1).max(200),
  filters: z.record(z.string(), z.unknown()).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searches = await getSavedSearches(session.user.id)
    return NextResponse.json({ searches })
  } catch (error) {
    console.error('Get saved searches error:', error)
    return NextResponse.json(
      { error: 'Failed to get saved searches' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const tier = await getUserTier(session.user.id)
    const saved = await createSavedSearch(session.user.id, tier, parsed.data)
    return NextResponse.json({ saved }, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create saved search'

    if (message.includes('limit reached')) {
      return NextResponse.json({ error: message }, { status: 403 })
    }

    // Prisma unique constraint violation
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'You already have a saved search for this query' },
        { status: 409 }
      )
    }

    console.error('Create saved search error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
