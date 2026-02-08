#!/usr/bin/env npx tsx
/**
 * Backfill Image Scores
 *
 * Re-scores existing content entries with full multi-modal analysis
 * (text + images) that were previously scored as text-only.
 *
 * Usage:
 *   npx tsx scripts/backfill-image-scores.ts [options]
 *
 * Options:
 *   --dry-run     Preview what would be re-scored without making changes
 *   --limit N     Process at most N entries (default: 10)
 *   --delay N     Delay in ms between entries to rate-limit ML service (default: 500)
 */

import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../src/generated/prisma/client'
import {
  extractMediaFromUrl,
  filterRelevantImages,
} from '../src/lib/services/media-extraction.service'
import { detectMultiModalContent } from '../src/lib/ai-detection'

// Parse CLI args
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) || 10 : 10
const delayIdx = args.indexOf('--delay')
const delayMs = delayIdx !== -1 ? parseInt(args[delayIdx + 1], 10) || 500 : 500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  // Set up Prisma client
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const adapter = new PrismaNeon({ connectionString: databaseUrl })
  const prisma = new PrismaClient({ adapter })

  console.log(`\n=== Backfill Image Scores ===`)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Limit: ${limit}`)
  console.log(`Delay: ${delayMs}ms between entries`)
  console.log(`ML Service: ${process.env.ML_SERVICE_URL || 'http://localhost:8000'}`)
  console.log()

  // Find content entries that were analyzed as text-only
  // (image_score IS NULL and the entry has a composite score)
  const textOnlyEntries = await prisma.$queryRawUnsafe<
    Array<{
      id: string
      content_id: string
      composite_score: number
      classification: string
    }>
  >(
    `SELECT as2.id, as2.content_id, as2.composite_score, as2.classification
     FROM ai_scores as2
     WHERE as2.image_score IS NULL
       AND as2.composite_score IS NOT NULL
     ORDER BY as2.created_at DESC
     LIMIT $1`,
    limit
  )

  console.log(`Found ${textOnlyEntries.length} text-only entries to backfill\n`)

  if (textOnlyEntries.length === 0) {
    console.log('Nothing to backfill!')
    await prisma.$disconnect()
    return
  }

  let processed = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const entry of textOnlyEntries) {
    processed++
    const prefix = `[${processed}/${textOnlyEntries.length}]`

    try {
      // Get the content URL
      const content = await prisma.content.findUnique({
        where: { id: entry.content_id },
        select: { url: true, contentText: true, title: true },
      })

      if (!content?.url || !content?.contentText) {
        console.log(`${prefix} SKIP - No content/URL for ${entry.content_id}`)
        skipped++
        continue
      }

      console.log(`${prefix} Processing: ${content.title || content.url}`)

      // Extract images from the page
      let images: Array<{ url?: string; base64?: string }> = []
      try {
        const extractedMedia = await extractMediaFromUrl(content.url)
        images = filterRelevantImages(extractedMedia.images, 5)
      } catch (err) {
        console.log(`${prefix}   Media extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }

      if (images.length === 0) {
        console.log(`${prefix}   No images found, skipping`)
        skipped++
        continue
      }

      console.log(`${prefix}   Found ${images.length} images`)

      if (dryRun) {
        console.log(`${prefix}   DRY RUN - would re-score with ${images.length} images`)
        updated++
        continue
      }

      // Run full multi-modal detection
      const result = await detectMultiModalContent({
        text: content.contentText,
        images,
      })

      const imageScore = result.contentScores.find((cs) => cs.type === 'image')
      const textScore = result.contentScores.find((cs) => cs.type === 'text')

      // Delete old AI score and media records
      await prisma.mediaScore.deleteMany({
        where: { media: { contentId: entry.content_id } },
      })
      await prisma.contentMedia.deleteMany({
        where: { contentId: entry.content_id },
      })
      await prisma.aiScore.delete({
        where: { id: entry.id },
      })

      // Create new AI score with multi-modal data
      await prisma.aiScore.create({
        data: {
          contentId: entry.content_id,
          compositeScore: result.compositeScore,
          classification: result.classification,
          gptzeroScore: null,
          heuristicScore: null,
          textScore: textScore?.score ?? null,
          textConfidence: textScore?.confidence ?? null,
          imageScore: imageScore?.score ?? null,
          imageConfidence: imageScore?.confidence ?? null,
          videoScore: null,
          videoConfidence: null,
          analyzedTypes: result.analyzedTypes,
          providerDetails: result.contentScores.length > 0
            ? JSON.parse(JSON.stringify(result.contentScores))
            : undefined,
          fusionDetails: result.metadata
            ? JSON.parse(JSON.stringify({
                method: 'multi_modal',
                modalityWeights: result.metadata.modalityWeights,
              }))
            : undefined,
        },
      })

      // Create ContentMedia + MediaScore records for images
      if (images.length > 0) {
        await prisma.contentMedia.createMany({
          data: images.map((img) => ({
            contentId: entry.content_id,
            type: 'image',
            url: img.url || null,
          })),
        })

        const createdMedia = await prisma.contentMedia.findMany({
          where: { contentId: entry.content_id, type: 'image' },
          orderBy: { createdAt: 'asc' },
        })

        const perImageScores = (imageScore?.metadata as Record<string, unknown>)
          ?.perImageScores as Array<{ score: number; confidence: number }> | undefined

        if (perImageScores && createdMedia.length > 0) {
          await prisma.mediaScore.createMany({
            data: createdMedia.map((media, idx) => ({
              mediaId: media.id,
              score: perImageScores[idx]?.score ?? 0.5,
              confidence: perImageScores[idx]?.confidence ?? 0.5,
              providerName: 'cnn_detection',
            })),
          })
        }
      }

      const oldScore = (1 - entry.composite_score) * 100
      const newScore = (1 - result.compositeScore) * 100
      console.log(
        `${prefix}   Updated: ${entry.classification} → ${result.classification} ` +
        `(${oldScore.toFixed(0)}% → ${newScore.toFixed(0)}% human)`
      )
      updated++

      // Rate limit
      if (processed < textOnlyEntries.length) {
        await sleep(delayMs)
      }
    } catch (err) {
      console.error(`${prefix} ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`)
      errors++
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Processed: ${processed}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (no images): ${skipped}`)
  console.log(`Errors: ${errors}`)
  if (dryRun) {
    console.log(`\nThis was a DRY RUN. Run without --dry-run to apply changes.`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
