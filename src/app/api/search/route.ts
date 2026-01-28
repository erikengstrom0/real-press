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
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))

  if (!query) {
    return NextResponse.json<SearchResponse>({
      results: [],
      query: '',
      filter: null,
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      hasMore: false,
    })
  }

  try {
    // Build the where clause
    const baseWhere = {
      status: 'analyzed' as const,
      OR: [
        { title: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } },
        { contentText: { contains: query, mode: 'insensitive' as const } },
        { url: { contains: query, mode: 'insensitive' as const } },
      ],
    }

    // Add classification filter if specified
    const whereClause = filter && ['human', 'likely_human', 'unsure', 'likely_ai', 'ai'].includes(filter)
      ? { ...baseWhere, aiScore: { classification: filter } }
      : baseWhere

    // Get total count for pagination
    const total = await prisma.content.count({ where: whereClause })

    // Get paginated results
    const content = await prisma.content.findMany({
      where: whereClause,
      include: {
        aiScore: true,
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
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
