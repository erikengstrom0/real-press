import prisma from '@/lib/db/prisma'
import { get as levenshteinDistance } from 'fast-levenshtein'

export interface SpellSuggestion {
  original: string
  suggested: string
  confidence: number
}

/**
 * Suggest a corrected query when the original returns 0 results.
 * Uses pg_trgm similarity against content titles + Levenshtein ranking.
 */
export async function getSpellSuggestion(
  query: string
): Promise<SpellSuggestion | null> {
  if (query.length < 3) return null

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)

  if (words.length === 0) return null

  const correctedWords: string[] = []
  let anyCorrected = false

  for (const word of words) {
    const candidate = await findBestMatch(word)
    if (candidate && candidate !== word) {
      correctedWords.push(candidate)
      anyCorrected = true
    } else {
      correctedWords.push(word)
    }
  }

  if (!anyCorrected) return null

  const suggested = correctedWords.join(' ')

  // Verify the corrected query actually returns results
  const hasResults = await checkQueryHasResults(suggested)
  if (!hasResults) return null

  // Confidence: ratio of corrected words weighted by similarity
  const confidence =
    correctedWords.reduce((sum, corrected, i) => {
      if (corrected === words[i]) return sum + 1
      const dist = levenshteinDistance(words[i], corrected)
      return sum + Math.max(0, 1 - dist / Math.max(words[i].length, corrected.length))
    }, 0) / words.length

  return { original: query, suggested, confidence }
}

async function findBestMatch(word: string): Promise<string | null> {
  // Query pg_trgm for similar words extracted from content titles
  const candidates: { candidate: string; sim: number }[] =
    await prisma.$queryRawUnsafe(
      `SELECT DISTINCT w AS candidate, similarity(w, $1) AS sim
       FROM (
         SELECT unnest(regexp_split_to_array(lower(title), '[^a-zA-Z0-9]+')) AS w
         FROM content
         WHERE status = 'analyzed' AND title IS NOT NULL
       ) words
       WHERE length(w) > 2
         AND similarity(w, $1) > 0.2
       ORDER BY sim DESC
       LIMIT 10`,
      word
    )

  if (candidates.length === 0) return null

  // Rank by Levenshtein distance (max 3 edits), then by similarity
  let best: string | null = null
  let bestScore = Infinity

  for (const { candidate } of candidates) {
    const dist = levenshteinDistance(word, candidate)
    if (dist > 3) continue
    if (dist < bestScore) {
      bestScore = dist
      best = candidate
    }
  }

  return best
}

async function checkQueryHasResults(query: string): Promise<boolean> {
  const count = await prisma.content.count({
    where: {
      status: 'analyzed',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { url: { contains: query, mode: 'insensitive' } },
        { domain: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: 1,
  })
  return count > 0
}
