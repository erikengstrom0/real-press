import { NextRequest, NextResponse } from 'next/server'
import { getJobStatus } from '@/lib/services/submission-queue.service'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id || id.length < 10) {
    return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
  }

  const status = await getJobStatus(id)

  if (!status) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Set cache headers based on status
  const headers: Record<string, string> = {}
  if (status.status === 'completed' || status.status === 'failed') {
    // Terminal states can be cached
    headers['Cache-Control'] = 'public, max-age=60'
  } else {
    // Active states should not be cached
    headers['Cache-Control'] = 'no-cache, no-store'
  }

  return NextResponse.json(status, { headers })
}
