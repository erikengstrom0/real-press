import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getSearchHistory,
  clearSearchHistory,
} from '@/lib/services/search-history.service'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    const history = await getSearchHistory(session.user.id, { limit, offset })
    return NextResponse.json({ history })
  } catch (error) {
    console.error('Get search history error:', error)
    return NextResponse.json(
      { error: 'Failed to get search history' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await clearSearchHistory(session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clear search history error:', error)
    return NextResponse.json(
      { error: 'Failed to clear search history' },
      { status: 500 }
    )
  }
}
