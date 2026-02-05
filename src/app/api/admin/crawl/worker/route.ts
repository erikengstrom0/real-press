import { NextRequest, NextResponse } from 'next/server'
import { processJobBatch } from '@/lib/services/crawl-worker.service'

// Allow up to 60 seconds for processing (Vercel Pro limit)
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
    let maxConcurrent = 3

    try {
      const body = await request.json()
      if (body.batchSize) batchSize = Math.min(body.batchSize, 10)
      if (body.maxConcurrent) maxConcurrent = Math.min(body.maxConcurrent, 5)
    } catch {
      // No body or invalid JSON, use defaults
    }

    const result = await processJobBatch({ batchSize, maxConcurrent })

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Worker process error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET for manual status check
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    message: 'Use POST to trigger job processing',
  })
}
