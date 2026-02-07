import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { deleteSavedSearch } from '@/lib/services/saved-search.service'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    await deleteSavedSearch(session.user.id, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete saved search'

    if (message === 'Saved search not found') {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    console.error('Delete saved search error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
