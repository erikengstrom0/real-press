/**
 * Author Service
 * Manages author records and statistics.
 */

import prisma from '@/lib/db/prisma'

function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
}

export async function getOrCreateAuthor(name: string, domain?: string) {
  const normalizedName = normalizeAuthorName(name)

  return prisma.author.upsert({
    where: { normalizedName },
    update: {
      lastSeen: new Date(),
      articleCount: { increment: 1 },
      domain: domain || undefined,
    },
    create: {
      name,
      normalizedName,
      domain: domain || null,
      articleCount: 1,
    },
  })
}

export async function updateAuthorStats(authorId: string): Promise<void> {
  // Calculate average AI score for this author's articles
  const avgScoreResult = await prisma.$queryRaw<[{ avg: number | null }]>`
    SELECT AVG(a.composite_score) as avg
    FROM content c
    JOIN ai_scores a ON c.id = a.content_id
    WHERE c.author_id = ${authorId}
  `

  const articleCount = await prisma.content.count({
    where: { authorId },
  })

  await prisma.author.update({
    where: { id: authorId },
    data: {
      avgScore: avgScoreResult[0]?.avg || null,
      articleCount,
    },
  })
}

export async function getAuthorByName(name: string) {
  const normalizedName = normalizeAuthorName(name)
  return prisma.author.findUnique({
    where: { normalizedName },
  })
}

export async function listAuthors(options: {
  limit?: number
  offset?: number
  sortBy?: 'articleCount' | 'avgScore' | 'name'
  sortOrder?: 'asc' | 'desc'
}) {
  const {
    limit = 50,
    offset = 0,
    sortBy = 'articleCount',
    sortOrder = 'desc',
  } = options

  const orderBy: Record<string, 'asc' | 'desc'> = {}
  orderBy[sortBy] = sortOrder

  const [authors, total] = await Promise.all([
    prisma.author.findMany({
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.author.count(),
  ])

  return { authors, total }
}

export async function getAuthorWithContent(authorId: string) {
  return prisma.author.findUnique({
    where: { id: authorId },
    include: {
      content: {
        include: {
          aiScore: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}
