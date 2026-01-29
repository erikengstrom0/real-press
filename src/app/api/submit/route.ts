import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractContent, ExtractionError } from '@/lib/services/extraction.service'
import { getContentByUrl, createContentFromExtraction } from '@/lib/services/content.service'
import { analyzeAndStoreScore } from '@/lib/services/ai-detection.service'
import { normalizeUrl } from '@/lib/utils/url'

const submitSchema = z.object({
  url: z.string().min(1, 'Please enter a URL'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Basic validation - check that url field exists
    const validation = submitSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    // Normalize the URL (add https:// if missing, etc.)
    const normalizeResult = normalizeUrl(validation.data.url)
    if (!normalizeResult.success) {
      return NextResponse.json(
        { error: `${normalizeResult.error}. ${normalizeResult.hint}` },
        { status: 400 }
      )
    }

    const url = normalizeResult.url

    // Check if URL already exists and return its info
    const existingContent = await getContentByUrl(url)
    if (existingContent) {
      return NextResponse.json(
        {
          error: 'This URL has already been analyzed',
          exists: true,
          contentId: existingContent.id,
          title: existingContent.title,
          url: existingContent.url,
          aiScore: existingContent.aiScore ? {
            score: existingContent.aiScore.compositeScore,
            classification: existingContent.aiScore.classification,
          } : null,
        },
        { status: 409 }
      )
    }

    const extracted = await extractContent(url)

    const content = await createContentFromExtraction(extracted)

    // Run AI detection and store the score
    const analysisResult = await analyzeAndStoreScore(content.id, extracted.contentText)

    return NextResponse.json({
      success: true,
      contentId: content.id,
      message: 'Content submitted and analyzed successfully',
      aiScore: {
        score: analysisResult.aiScore.compositeScore,
        classification: analysisResult.aiScore.classification,
      },
    })
  } catch (error) {
    if (error instanceof ExtractionError) {
      return NextResponse.json(
        { error: error.message },
        { status: 422 }
      )
    }

    console.error('Submit error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
