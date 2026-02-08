/**
 * POST /api/admin/rescore
 *
 * Re-scores a specific content entry with full multi-modal analysis (text + images).
 * Replaces the existing AI score with a new one that includes image detection.
 *
 * Protected by ADMIN_SECRET (middleware handles auth for /api/admin/* routes).
 *
 * Body: { contentId: string }
 *
 * Returns: { old, new, imagesFound, imagesScored }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import {
  extractMediaFromUrl,
  filterRelevantImages,
} from '@/lib/services/media-extraction.service'
import { analyzeMultiModalAndStore } from '@/lib/services/ai-detection.service'

export const maxDuration = 60

const requestSchema = z.object({
  contentId: z.string().min(1, 'contentId is required'),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    )
  }

  const { contentId } = parsed.data

  // Fetch the content
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: { id: true, url: true, contentText: true, title: true },
  })

  if (!content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  if (!content.contentText) {
    return NextResponse.json({ error: 'Content has no text to analyze' }, { status: 422 })
  }

  // Get existing score for comparison
  const existingScore = await prisma.aiScore.findUnique({
    where: { contentId },
    select: {
      compositeScore: true,
      classification: true,
      imageScore: true,
      analyzedTypes: true,
    },
  })

  const oldData = existingScore
    ? {
        compositeScore: existingScore.compositeScore,
        classification: existingScore.classification,
        imageScore: existingScore.imageScore,
        analyzedTypes: existingScore.analyzedTypes,
      }
    : null

  // Extract images from the page
  let images: Array<{ url?: string; base64?: string }> = []
  try {
    const extractedMedia = await extractMediaFromUrl(content.url)
    images = filterRelevantImages(extractedMedia.images, 5)
  } catch {
    // Media extraction failed — continue with text-only
  }

  // Delete existing score and media records to avoid unique constraint issues
  await prisma.mediaScore.deleteMany({
    where: { media: { contentId } },
  })
  await prisma.contentMedia.deleteMany({
    where: { contentId },
  })
  await prisma.aiScore.deleteMany({
    where: { contentId },
  })

  // Re-score with full multi-modal analysis
  const result = await analyzeMultiModalAndStore(contentId, {
    text: content.contentText,
    images: images.length > 0 ? images : undefined,
  })

  return NextResponse.json({
    contentId,
    title: content.title,
    url: content.url,
    imagesFound: images.length,
    imagesScored: result.aiScore.imageScore !== null ? images.length : 0,
    old: oldData,
    new: {
      compositeScore: result.aiScore.compositeScore,
      classification: result.aiScore.classification,
      imageScore: result.aiScore.imageScore,
      analyzedTypes: result.aiScore.analyzedTypes,
    },
  })
}
