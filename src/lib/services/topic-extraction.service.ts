/**
 * Topic Extraction Service
 * Extracts topics from content using keyword matching and TF-IDF-like scoring.
 */

import prisma from '@/lib/db/prisma'

// Predefined topic taxonomy with associated keywords
const TOPIC_TAXONOMY: Record<string, string[]> = {
  technology: [
    'software', 'programming', 'code', 'developer', 'app', 'application',
    'computer', 'tech', 'digital', 'internet', 'web', 'algorithm', 'data',
    'cloud', 'server', 'database', 'api', 'framework', 'platform',
  ],
  'artificial-intelligence': [
    'ai', 'artificial intelligence', 'machine learning', 'ml', 'neural network',
    'deep learning', 'chatgpt', 'gpt', 'llm', 'language model', 'automation',
    'robot', 'autonomous', 'algorithm', 'prediction', 'classification',
  ],
  startup: [
    'startup', 'founder', 'entrepreneur', 'venture', 'investor', 'funding',
    'seed', 'series a', 'pitch', 'mvp', 'product market fit', 'growth',
    'scale', 'bootstrap', 'vc', 'accelerator', 'incubator',
  ],
  productivity: [
    'productivity', 'habit', 'routine', 'focus', 'time management', 'goal',
    'efficiency', 'workflow', 'organization', 'priority', 'task', 'schedule',
    'morning routine', 'discipline', 'motivation', 'procrastination',
  ],
  'personal-development': [
    'self improvement', 'personal growth', 'mindset', 'learning', 'skill',
    'career', 'success', 'failure', 'resilience', 'confidence', 'fear',
    'anxiety', 'happiness', 'fulfillment', 'purpose', 'meaning', 'life',
  ],
  writing: [
    'writing', 'writer', 'author', 'essay', 'blog', 'content', 'story',
    'narrative', 'publish', 'book', 'article', 'journalism', 'copywriting',
    'creative writing', 'editing', 'draft',
  ],
  science: [
    'science', 'research', 'study', 'experiment', 'hypothesis', 'theory',
    'physics', 'chemistry', 'biology', 'mathematics', 'scientific', 'discovery',
    'laboratory', 'peer review', 'journal', 'academic',
  ],
  psychology: [
    'psychology', 'mental', 'cognitive', 'behavior', 'brain', 'mind',
    'emotion', 'therapy', 'consciousness', 'perception', 'memory', 'thinking',
    'decision', 'bias', 'heuristic', 'psychological',
  ],
  philosophy: [
    'philosophy', 'philosophical', 'ethics', 'moral', 'existence', 'meaning',
    'truth', 'reality', 'consciousness', 'free will', 'determinism',
    'metaphysics', 'epistemology', 'logic', 'reason',
  ],
  business: [
    'business', 'company', 'corporate', 'management', 'strategy', 'market',
    'customer', 'revenue', 'profit', 'sales', 'marketing', 'brand',
    'industry', 'competition', 'leadership', 'executive',
  ],
  finance: [
    'finance', 'money', 'investment', 'stock', 'market', 'trading', 'wealth',
    'portfolio', 'asset', 'dividend', 'compound', 'interest', 'savings',
    'retirement', 'crypto', 'bitcoin', 'economy', 'inflation',
  ],
  health: [
    'health', 'medical', 'wellness', 'fitness', 'exercise', 'diet', 'nutrition',
    'sleep', 'stress', 'disease', 'treatment', 'doctor', 'hospital',
    'medicine', 'mental health', 'physical', 'body',
  ],
  design: [
    'design', 'designer', 'ux', 'ui', 'user experience', 'interface', 'visual',
    'graphic', 'aesthetic', 'layout', 'typography', 'color', 'creative',
    'prototype', 'wireframe', 'figma',
  ],
  culture: [
    'culture', 'society', 'social', 'community', 'tradition', 'art', 'music',
    'film', 'movie', 'book', 'literature', 'media', 'entertainment',
    'popular', 'trend', 'generation',
  ],
  politics: [
    'politics', 'political', 'government', 'policy', 'election', 'vote',
    'democracy', 'republican', 'democrat', 'congress', 'senate', 'law',
    'regulation', 'president', 'campaign',
  ],
  environment: [
    'environment', 'climate', 'sustainability', 'green', 'renewable', 'energy',
    'carbon', 'emission', 'pollution', 'conservation', 'nature', 'ecosystem',
    'biodiversity', 'recycling', 'solar', 'wind',
  ],
}

interface TopicScore {
  topic: string
  slug: string
  score: number
  matchedKeywords: string[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
}

function createNgrams(words: string[], n: number): string[] {
  const ngrams: string[] = []
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '))
  }
  return ngrams
}

export function extractTopics(text: string, maxTopics: number = 5): TopicScore[] {
  const words = tokenize(text)
  const wordSet = new Set(words)

  // Also check bigrams for multi-word keywords
  const bigrams = new Set(createNgrams(words, 2))
  const trigrams = new Set(createNgrams(words, 3))

  const topicScores: TopicScore[] = []

  for (const [topic, keywords] of Object.entries(TOPIC_TAXONOMY)) {
    const matchedKeywords: string[] = []
    let score = 0

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase()
      const keywordWords = keywordLower.split(' ')

      let matched = false

      if (keywordWords.length === 1) {
        // Single word keyword
        if (wordSet.has(keywordLower)) {
          matched = true
        }
      } else if (keywordWords.length === 2) {
        // Bigram keyword
        if (bigrams.has(keywordLower)) {
          matched = true
        }
      } else if (keywordWords.length === 3) {
        // Trigram keyword
        if (trigrams.has(keywordLower)) {
          matched = true
        }
      }

      if (matched) {
        matchedKeywords.push(keyword)
        // Weight multi-word matches higher
        score += keywordWords.length
      }
    }

    if (matchedKeywords.length > 0) {
      // Normalize score by number of keywords in taxonomy
      const normalizedScore = score / keywords.length

      topicScores.push({
        topic,
        slug: slugify(topic),
        score: Math.round(normalizedScore * 1000) / 1000,
        matchedKeywords,
      })
    }
  }

  // Sort by score and return top N
  return topicScores
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTopics)
}

export async function getOrCreateTopic(name: string, slug: string) {
  return prisma.topic.upsert({
    where: { slug },
    update: {},
    create: { name, slug },
  })
}

export async function linkContentToTopics(
  contentId: string,
  topics: TopicScore[]
): Promise<void> {
  for (const topicScore of topics) {
    const topic = await getOrCreateTopic(
      topicScore.topic.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      topicScore.slug
    )

    await prisma.contentTopic.upsert({
      where: {
        contentId_topicId: {
          contentId,
          topicId: topic.id,
        },
      },
      update: {
        relevance: topicScore.score,
      },
      create: {
        contentId,
        topicId: topic.id,
        relevance: topicScore.score,
      },
    })
  }
}

export async function updateTopicStats(): Promise<void> {
  // Update article counts and average scores for all topics
  const topics = await prisma.topic.findMany()

  for (const topic of topics) {
    const stats = await prisma.contentTopic.aggregate({
      where: { topicId: topic.id },
      _count: true,
    })

    const avgScoreResult = await prisma.$queryRaw<[{ avg: number | null }]>`
      SELECT AVG(a.composite_score) as avg
      FROM content_topics ct
      JOIN content c ON ct.content_id = c.id
      JOIN ai_scores a ON c.id = a.content_id
      WHERE ct.topic_id = ${topic.id}
    `

    await prisma.topic.update({
      where: { id: topic.id },
      data: {
        articleCount: stats._count,
        avgScore: avgScoreResult[0]?.avg || null,
      },
    })
  }
}
