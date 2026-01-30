import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractContent, ExtractionError } from '@/lib/services/extraction.service'
import { getContentByUrl, createContentFromExtraction } from '@/lib/services/content.service'
import {
  analyzeAndStoreScore,
  analyzeMultiModalAndStore,
} from '@/lib/services/ai-detection.service'
import { normalizeUrl } from '@/lib/utils/url'
import {
  extractMediaFromUrl,
  filterRelevantImages,
} from '@/lib/services/media-extraction.service'

const submitSchema = z.object({
  url: z.string().min(1, 'Please enter a URL'),
  // Optional: explicit image URLs to analyze
  imageUrls: z.array(z.string().url()).optional(),
  // Optional: explicit video URL to analyze
  videoUrl: z.string().url().optional(),
  // Whether to extract and analyze media from the page
  extractMedia: z.boolean().optional().default(false),
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

    // Collect media to analyze
    const images: Array<{ url?: string; base64?: string }> = []
    let videoUrl: string | undefined

    // Add explicit image URLs if provided
    if (validation.data.imageUrls) {
      for (const imgUrl of validation.data.imageUrls) {
        images.push({ url: imgUrl })
      }
    }

    // Add explicit video URL if provided
    if (validation.data.videoUrl) {
      videoUrl = validation.data.videoUrl
    }

    // Extract media from page if requested
    if (validation.data.extractMedia) {
      const extractedMedia = await extractMediaFromUrl(url)
      const relevantImages = filterRelevantImages(extractedMedia.images, 5)

      for (const img of relevantImages) {
        // Don't add duplicates
        if (!images.some((i) => i.url === img.url)) {
          images.push(img)
        }
      }

      // Use extracted video if no explicit video provided
      if (!videoUrl && extractedMedia.video) {
        videoUrl = extractedMedia.video.url
      }
    }

    // Determine if we need multi-modal analysis
    const hasMedia = images.length > 0 || videoUrl

    let analysisResult

    if (hasMedia) {
      // Run multi-modal AI detection
      analysisResult = await analyzeMultiModalAndStore(content.id, {
        text: extracted.contentText,
        images: images.length > 0 ? images : undefined,
        videoUrl,
      })

      return NextResponse.json({
        success: true,
        contentId: content.id,
        message: 'Content submitted and analyzed successfully',
        aiScore: {
          score: analysisResult.aiScore.compositeScore,
          classification: analysisResult.aiScore.classification,
          analyzedTypes: analysisResult.aiScore.analyzedTypes,
          textScore: analysisResult.aiScore.textScore,
          imageScore: analysisResult.aiScore.imageScore,
          videoScore: analysisResult.aiScore.videoScore,
        },
      })
    } else {
      // Run text-only AI detection (backwards compatible)
      analysisResult = await analyzeAndStoreScore(content.id, extracted.contentText)

      return NextResponse.json({
        success: true,
        contentId: content.id,
        message: 'Content submitted and analyzed successfully',
        aiScore: {
          score: analysisResult.aiScore.compositeScore,
          classification: analysisResult.aiScore.classification,
        },
      })
    }
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
