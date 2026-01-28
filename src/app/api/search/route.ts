import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import type { Classification } from '@/lib/ai-detection'

export interface SearchResult {
  id: string
  title: string
  description: string | null
  url: string
  domain: string
  aiScore: {
    score: number
    classification: Classification
  } | null
  createdAt: string
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
  filter: string | null
  sort: string | null
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

const PAGE_SIZE = 10

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')?.trim() || ''
  const filter = searchParams.get('filter') // classification filter
  const sort = searchParams.get('sort') // 'score' = sort by AI score ascending (human first)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))

  if (!query) {
    return NextResponse.json<SearchResponse>({
      results: [],
      query: '',
      filter: null,
      sort: null,
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      hasMore: false,
    })
  }

  try {
    // Build the search conditions
    const searchConditions = [
      { title: { contains: query, mode: 'insensitive' as const } },
      { description: { contains: query, mode: 'insensitive' as const } },
      { contentText: { contains: query, mode: 'insensitive' as const } },
      { url: { contains: query, mode: 'insensitive' as const } },
    ]

    // Build the where clause based on filter
    // 'human' filter = human + likely_human
    // 'ai' filter = likely_ai + ai
    const whereClause = filter === 'human'
      ? {
          status: 'analyzed' as const,
          OR: searchConditions,
          aiScore: { classification: { in: ['human', 'likely_human'] } },
        }
      : filter === 'ai'
        ? {
            status: 'analyzed' as const,
            OR: searchConditions,
            aiScore: { classification: { in: ['likely_ai', 'ai'] } },
          }
        : {
            status: 'analyzed' as const,
            OR: searchConditions,
          }

    // Get total count for pagination
    const total = await prisma.content.count({ where: whereClause })

    // Build orderBy based on sort parameter
    // sort=score: order by AI score ascending (lowest = most human first)
    const orderBy = sort === 'score'
      ? { aiScore: { compositeScore: 'asc' as const } }
      : { createdAt: 'desc' as const }

    // Get paginated results
    const content = await prisma.content.findMany({
      where: whereClause,
      include: {
        aiScore: true,
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    })

    const results: SearchResult[] = content.map((item) => ({
      id: item.id,
      title: item.title || item.url,
      description: item.description,
      url: item.url,
      domain: item.domain,
      aiScore: item.aiScore
        ? {
            score: item.aiScore.compositeScore,
            classification: item.aiScore.classification as Classification,
          }
        : null,
      createdAt: item.createdAt.toISOString(),
    }))

    return NextResponse.json<SearchResponse>({
      results,
      query,
      filter,
      sort,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: page * PAGE_SIZE < total,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
