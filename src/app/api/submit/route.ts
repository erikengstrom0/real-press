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
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { validateUrlForFetch } from '@/lib/utils/ssrf-protection'
import { isDomainBlocked, isSuspiciousUrl, isUrlShortener } from '@/lib/security/domain-blocklist'
import { resolveUrl } from '@/lib/security/url-resolver'
import { validateContent } from '@/lib/security/content-validator'
import { logSubmission } from '@/lib/security/submission-log'
import { checkSubmissionAllowed } from '@/lib/security/submission-guard'

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
  const rateLimitResponse = await checkRateLimit(request, 'submit')
  if (rateLimitResponse) return rateLimitResponse

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'anonymous'

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

    let url = normalizeResult.url

    // SSRF protection: block private/internal URLs
    const ssrfCheck = await validateUrlForFetch(url)
    if (!ssrfCheck.safe) {
      logSubmission({ ip, url, outcome: 'blocked', reason: ssrfCheck.error })
      return NextResponse.json(
        { error: ssrfCheck.error },
        { status: 400 }
      )
    }

    // Domain blocklist check
    const blockCheck = await isDomainBlocked(url)
    if (blockCheck.blocked) {
      logSubmission({ ip, url, outcome: 'blocked', reason: blockCheck.reason })
      return NextResponse.json(
        { error: 'This URL cannot be submitted' },
        { status: 403 }
      )
    }

    // Suspicious URL heuristics (log but allow for now)
    const suspicion = isSuspiciousUrl(url)
    if (suspicion.suspicious) {
      logSubmission({ ip, url, outcome: 'blocked', reason: suspicion.reasons.join('; ') })
      return NextResponse.json(
        { error: 'This URL has been flagged as suspicious and cannot be submitted' },
        { status: 403 }
      )
    }

    // Resolve URL shorteners to final destination
    if (isUrlShortener(url)) {
      const resolved = await resolveUrl(url)
      if (!resolved.safe) {
        logSubmission({ ip, url, outcome: 'blocked', reason: resolved.error })
        return NextResponse.json(
          { error: resolved.error || 'URL redirect chain blocked' },
          { status: 403 }
        )
      }
      url = resolved.finalUrl
    }

    // Per-user / per-IP submission guard
    const guardResult = await checkSubmissionAllowed(null, ip)
    if (!guardResult.allowed) {
      logSubmission({ ip, url, outcome: 'blocked', reason: guardResult.reason })
      return NextResponse.json(
        { error: guardResult.reason || 'Submission limit reached' },
        { status: 429 }
      )
    }

    // Also validate any explicit media URLs
    if (validation.data.imageUrls) {
      for (const imgUrl of validation.data.imageUrls) {
        const imgCheck = await validateUrlForFetch(imgUrl)
        if (!imgCheck.safe) {
          return NextResponse.json(
            { error: `Image URL blocked: ${imgCheck.error}` },
            { status: 400 }
          )
        }
      }
    }
    if (validation.data.videoUrl) {
      const vidCheck = await validateUrlForFetch(validation.data.videoUrl)
      if (!vidCheck.safe) {
        return NextResponse.json(
          { error: `Video URL blocked: ${vidCheck.error}` },
          { status: 400 }
        )
      }
    }

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

    // Post-extraction content quality validation
    const contentCheck = validateContent({
      text: extracted.contentText,
      url: extracted.url,
      domain: extracted.domain,
    })
    if (!contentCheck.valid) {
      logSubmission({ ip, url, outcome: 'blocked', reason: contentCheck.reasons.join('; ') })
      return NextResponse.json(
        { error: contentCheck.reasons[0] || 'Content did not pass quality checks' },
        { status: 422 }
      )
    }

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

      logSubmission({ ip, url, outcome: 'success' })

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

      logSubmission({ ip, url, outcome: 'success' })

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
