import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createCrawlJobsBatch,
  listJobs,
  getJobStats,
} from '@/lib/services/crawl-job.service'
import { CrawlStatus } from '@/generated/prisma/client'

const createJobsSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(500),
  sourceType: z.string().optional(),
  source: z.string().optional(),
  priority: z.number().int().min(-10).max(10).optional().default(0),
}).transform(data => ({
  ...data,
  sourceType: data.sourceType || data.source || 'manual',
}))

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { urls, sourceType, priority } = createJobsSchema.parse(body)

    const result = await createCrawlJobsBatch(urls, sourceType, priority)

    return NextResponse.json({
      success: true,
      submitted: urls.length,
      created: result.created,
      duplicates: result.duplicates,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create jobs error:', error)
    return NextResponse.json(
      { error: 'Failed to create jobs' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status') as CrawlStatus | null
    const domain = searchParams.get('domain')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const statsOnly = searchParams.get('stats') === 'true'

    if (statsOnly) {
      const stats = await getJobStats()
      return NextResponse.json({ stats })
    }

    const result = await listJobs({
      status: status || undefined,
      domain: domain || undefined,
      limit: Math.min(limit, 100),
      offset,
    })

    const stats = await getJobStats()

    return NextResponse.json({
      ...result,
      stats,
    })
  } catch (error) {
    console.error('List jobs error:', error)
    return NextResponse.json(
      { error: 'Failed to list jobs' },
      { status: 500 }
    )
  }
}
