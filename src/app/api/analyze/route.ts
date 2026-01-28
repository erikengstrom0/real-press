import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { analyzeContentPreview, reanalyzeContent } from '@/lib/services/ai-detection.service'
import { getContentById } from '@/lib/services/content.service'

const analyzeSchema = z.union([
  z.object({
    text: z.string().min(1, 'Text is required'),
    contentId: z.undefined(),
  }),
  z.object({
    text: z.undefined(),
    contentId: z.string().uuid('Invalid content ID'),
  }),
])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = analyzeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { text, contentId } = validation.data

    // If text is provided, do a preview analysis (no storage)
    if (text) {
      const result = await analyzeContentPreview(text)

      return NextResponse.json({
        success: true,
        preview: true,
        score: result.compositeScore,
        classification: result.classification,
        details: {
          gptzeroScore: result.gptzeroScore,
          heuristicScore: result.heuristicScore,
          gptzeroAvailable: result.metadata?.gptzeroAvailable ?? false,
        },
      })
    }

    // If contentId is provided, re-analyze existing content
    if (contentId) {
      const content = await getContentById(contentId)

      if (!content) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 })
      }

      const result = await reanalyzeContent(contentId, content.contentText)

      return NextResponse.json({
        success: true,
        preview: false,
        contentId,
        score: result.aiScore.compositeScore,
        classification: result.aiScore.classification,
        details: {
          gptzeroScore: result.aiScore.gptzeroScore,
          heuristicScore: result.aiScore.heuristicScore,
        },
      })
    }

    return NextResponse.json(
      { error: 'Either text or contentId must be provided' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
