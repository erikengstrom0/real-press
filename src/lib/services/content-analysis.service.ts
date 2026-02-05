/**
 * Content Analysis Service
 * Extracts stylometric and content metrics from text for AI detection insights.
 */

export interface ContentAnalysis {
  // Basic metrics
  wordCount: number
  sentenceCount: number
  paragraphCount: number
  readingLevel: number

  // Stylometric analysis
  vocabularyDiversity: number
  avgSentenceLength: number
  sentenceLengthVariance: number
  punctuationDiversity: number
  repetitionScore: number

  // Advanced NLP metrics
  sentimentScore: number
  namedEntityDensity: number
  temporalReferenceDensity: number
}

// Common temporal reference patterns
const TEMPORAL_PATTERNS = [
  /\byesterday\b/gi,
  /\btoday\b/gi,
  /\btomorrow\b/gi,
  /\blast\s+(week|month|year|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  /\bnext\s+(week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  /\bthis\s+(morning|afternoon|evening|week|month|year)\b/gi,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi,
  /\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)/gi,
  /\bin\s+\d{4}\b/gi,
  /\b(19|20)\d{2}\b/g,
  /\b\d+\s+(days?|weeks?|months?|years?)\s+ago\b/gi,
  /\brecently\b/gi,
  /\bcurrently\b/gi,
  /\bat\s+the\s+moment\b/gi,
  /\bright\s+now\b/gi,
]

// Named entity patterns (simplified - proper NER would use ML)
const NAMED_ENTITY_PATTERNS = [
  // Capitalized words that aren't sentence starters (approximation)
  /(?<=[.!?]\s+[A-Z][a-z]+\s+)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,
  // Known prefixes
  /\b(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+/g,
  // Organizations (Inc, LLC, Corp, etc.)
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|LLC|Corp|Ltd|Co)\b/g,
  // Locations with common suffixes
  /\b[A-Z][a-z]+(?:ville|town|city|burg|berg|land|stan|ia)\b/g,
]

// Positive and negative sentiment words (simplified lexicon)
const POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love',
  'happy', 'joy', 'beautiful', 'best', 'perfect', 'awesome', 'brilliant',
  'success', 'successful', 'win', 'winning', 'positive', 'excited', 'exciting',
  'helpful', 'useful', 'valuable', 'important', 'effective', 'efficient',
  'innovative', 'creative', 'inspiring', 'impressive', 'remarkable', 'outstanding',
])

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'horrible', 'awful', 'hate', 'sad', 'angry', 'worst',
  'fail', 'failure', 'failed', 'poor', 'negative', 'problem', 'problems',
  'difficult', 'hard', 'wrong', 'mistake', 'mistakes', 'error', 'errors',
  'disappointing', 'disappointed', 'frustrating', 'frustrated', 'annoying',
  'useless', 'waste', 'boring', 'confusing', 'complicated', 'broken',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)
}

function getSentences(text: string): string[] {
  // Split on sentence-ending punctuation, but be careful with abbreviations
  return text
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function getParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

function calculateReadingLevel(text: string, wordCount: number, sentenceCount: number): number {
  // Flesch-Kincaid Grade Level
  if (wordCount === 0 || sentenceCount === 0) return 0

  const words = tokenize(text)
  const syllableCount = words.reduce((count, word) => count + countSyllables(word), 0)

  const avgWordsPerSentence = wordCount / sentenceCount
  const avgSyllablesPerWord = syllableCount / wordCount

  // Flesch-Kincaid Grade Level formula
  const gradeLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59

  return Math.max(0, Math.min(20, gradeLevel)) // Clamp to reasonable range
}

function countSyllables(word: string): number {
  word = word.toLowerCase()
  if (word.length <= 3) return 1

  // Remove silent e at end
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')

  // Count vowel groups
  const matches = word.match(/[aeiouy]{1,2}/g)
  return matches ? matches.length : 1
}

function calculateVocabularyDiversity(words: string[]): number {
  if (words.length === 0) return 0

  const uniqueWords = new Set(words)
  // Type-Token Ratio (TTR)
  return uniqueWords.size / words.length
}

function calculateSentenceLengthStats(sentences: string[]): {
  avgLength: number
  variance: number
} {
  if (sentences.length === 0) return { avgLength: 0, variance: 0 }

  const lengths = sentences.map((s) => tokenize(s).length)
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length

  if (lengths.length < 2) return { avgLength, variance: 0 }

  const squaredDiffs = lengths.map((len) => Math.pow(len - avgLength, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length

  // Return coefficient of variation (normalized variance)
  const coefficientOfVariation = avgLength > 0 ? Math.sqrt(variance) / avgLength : 0

  return { avgLength, variance: coefficientOfVariation }
}

function calculatePunctuationDiversity(text: string): number {
  const punctuationMarks = text.match(/[.,!?;:'"()\-—–]/g) || []
  if (punctuationMarks.length === 0) return 0

  const uniquePunctuation = new Set(punctuationMarks)
  // Normalize to 0-1 range (max ~10 common punctuation types)
  return Math.min(1, uniquePunctuation.size / 10)
}

function calculateRepetitionScore(words: string[]): number {
  if (words.length < 10) return 0

  // Look for repeated phrases (2-4 word n-grams)
  const ngramCounts: Map<string, number> = new Map()

  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(' ')
      ngramCounts.set(ngram, (ngramCounts.get(ngram) || 0) + 1)
    }
  }

  // Count repeated n-grams (appearing more than twice)
  let repeatedCount = 0
  const counts = Array.from(ngramCounts.values())
  for (const count of counts) {
    if (count > 2) repeatedCount += count - 2
  }

  // Normalize by text length
  return Math.min(1, repeatedCount / (words.length / 10))
}

function calculateSentimentScore(words: string[]): number {
  let positiveCount = 0
  let negativeCount = 0

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveCount++
    if (NEGATIVE_WORDS.has(word)) negativeCount++
  }

  const total = positiveCount + negativeCount
  if (total === 0) return 0.5 // Neutral

  // Return value between 0 (negative) and 1 (positive)
  return positiveCount / total
}

function calculateNamedEntityDensity(text: string, wordCount: number): number {
  if (wordCount === 0) return 0

  let entityCount = 0
  for (const pattern of NAMED_ENTITY_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) entityCount += matches.length
  }

  // Also count capitalized words in middle of sentences as potential entities
  const midSentenceCapitals = text.match(/(?<=[a-z]\s)[A-Z][a-z]{2,}/g)
  if (midSentenceCapitals) entityCount += midSentenceCapitals.length

  // Return density (entities per 100 words)
  return (entityCount / wordCount) * 100
}

function calculateTemporalReferenceDensity(text: string, wordCount: number): number {
  if (wordCount === 0) return 0

  let temporalCount = 0
  for (const pattern of TEMPORAL_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) temporalCount += matches.length
  }

  // Return density (references per 100 words)
  return (temporalCount / wordCount) * 100
}

export function analyzeContent(text: string): ContentAnalysis {
  const words = tokenize(text)
  const sentences = getSentences(text)
  const paragraphs = getParagraphs(text)

  const wordCount = words.length
  const sentenceCount = sentences.length
  const paragraphCount = paragraphs.length

  const readingLevel = calculateReadingLevel(text, wordCount, sentenceCount)
  const vocabularyDiversity = calculateVocabularyDiversity(words)

  const { avgLength, variance } = calculateSentenceLengthStats(sentences)

  const punctuationDiversity = calculatePunctuationDiversity(text)
  const repetitionScore = calculateRepetitionScore(words)

  const sentimentScore = calculateSentimentScore(words)
  const namedEntityDensity = calculateNamedEntityDensity(text, wordCount)
  const temporalReferenceDensity = calculateTemporalReferenceDensity(text, wordCount)

  return {
    wordCount,
    sentenceCount,
    paragraphCount,
    readingLevel: Math.round(readingLevel * 10) / 10,

    vocabularyDiversity: Math.round(vocabularyDiversity * 1000) / 1000,
    avgSentenceLength: Math.round(avgLength * 10) / 10,
    sentenceLengthVariance: Math.round(variance * 1000) / 1000,
    punctuationDiversity: Math.round(punctuationDiversity * 1000) / 1000,
    repetitionScore: Math.round(repetitionScore * 1000) / 1000,

    sentimentScore: Math.round(sentimentScore * 1000) / 1000,
    namedEntityDensity: Math.round(namedEntityDensity * 100) / 100,
    temporalReferenceDensity: Math.round(temporalReferenceDensity * 100) / 100,
  }
}

export function countLinks(html: string): { total: number; external: number } {
  const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi
  const matches = Array.from(html.matchAll(linkPattern))

  let external = 0
  for (const match of matches) {
    const href = match[1]
    if (href.startsWith('http://') || href.startsWith('https://')) {
      external++
    }
  }

  return { total: matches.length, external }
}

export function countImages(html: string): number {
  const imgPattern = /<img\s+[^>]*>/gi
  const matches = html.match(imgPattern)
  return matches ? matches.length : 0
}

export function hasVideoContent(html: string): boolean {
  const videoPatterns = [
    /<video\s+[^>]*>/i,
    /youtube\.com\/embed/i,
    /vimeo\.com\/video/i,
    /player\.vimeo\.com/i,
    /<iframe[^>]*youtube/i,
    /<iframe[^>]*vimeo/i,
  ]

  return videoPatterns.some((pattern) => pattern.test(html))
}
