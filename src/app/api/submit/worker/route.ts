import { NextRequest, NextResponse } from 'next/server'
import { processSubmissionBatch, getQueueStats } from '@/lib/services/submission-queue.service'

// Allow up to 60 seconds for processing
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for automated calls
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow if: valid cron secret OR no secret configured (dev mode)
    const isAuthorized = !cronSecret || authHeader === `Bearer ${cronSecret}`

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse optional parameters from body
    let batchSize = 5

    try {
      const body = await request.json()
      if (body.batchSize) batchSize = Math.min(body.batchSize, 10)
    } catch {
      // No body or invalid JSON, use defaults
    }

    const result = await processSubmissionBatch(batchSize)

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Submission worker error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  const stats = await getQueueStats()
  return NextResponse.json({
    status: 'ready',
    ...stats,
    message: 'Use POST to trigger submission processing',
  })
}
