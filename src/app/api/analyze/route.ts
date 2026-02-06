import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  analyzeContentPreview,
  reanalyzeContent,
  analyzeMultiModalPreview,
} from '@/lib/services/ai-detection.service'
import { getContentById } from '@/lib/services/content.service'
import { checkRateLimit } from '@/lib/utils/rate-limit'

const imageInputSchema = z.object({
  url: z.string().url().optional(),
  base64: z.string().optional(),
})

const analyzeSchema = z.union([
  // Text-only preview (backwards compatible)
  z.object({
    text: z.string().min(1, 'Text is required'),
    contentId: z.undefined(),
    images: z.undefined(),
    videoUrl: z.undefined(),
  }),
  // Re-analyze existing content
  z.object({
    text: z.undefined(),
    contentId: z.string().uuid('Invalid content ID'),
    images: z.undefined(),
    videoUrl: z.undefined(),
  }),
  // Multi-modal preview
  z.object({
    text: z.string().optional(),
    contentId: z.undefined(),
    images: z.array(imageInputSchema).optional(),
    videoUrl: z.string().url().optional(),
  }),
])

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, 'analyze')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()

    const validation = analyzeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const data = validation.data

    // Re-analyze existing content by contentId
    if ('contentId' in data && data.contentId) {
      const content = await getContentById(data.contentId)

      if (!content) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 })
      }

      const result = await reanalyzeContent(data.contentId, content.contentText)

      return NextResponse.json({
        success: true,
        preview: false,
        contentId: data.contentId,
        score: result.aiScore.compositeScore,
        classification: result.aiScore.classification,
        details: {
          gptzeroScore: result.aiScore.gptzeroScore,
          heuristicScore: result.aiScore.heuristicScore,
        },
      })
    }

    // Check if this is a multi-modal request
    const hasImages = 'images' in data && data.images && data.images.length > 0
    const hasVideo = 'videoUrl' in data && data.videoUrl
    const hasText = 'text' in data && data.text

    if (hasImages || hasVideo) {
      // Multi-modal preview analysis
      const result = await analyzeMultiModalPreview({
        text: hasText ? data.text : undefined,
        images: hasImages ? data.images : undefined,
        videoUrl: hasVideo ? data.videoUrl : undefined,
      })

      return NextResponse.json({
        success: true,
        preview: true,
        multiModal: true,
        score: result.compositeScore,
        classification: result.classification,
        analyzedTypes: result.analyzedTypes,
        details: {
          textScore: result.metadata?.textScore ?? null,
          textConfidence: result.metadata?.textConfidence ?? null,
          imageScore: result.metadata?.imageScore ?? null,
          imageConfidence: result.metadata?.imageConfidence ?? null,
          videoScore: result.metadata?.videoScore ?? null,
          videoConfidence: result.metadata?.videoConfidence ?? null,
        },
      })
    }

    // Text-only preview (backwards compatible)
    if (hasText && data.text) {
      const result = await analyzeContentPreview(data.text)

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

    return NextResponse.json(
      { error: 'Either text, images, videoUrl, or contentId must be provided' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
