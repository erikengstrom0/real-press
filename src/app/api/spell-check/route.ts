import { NextRequest, NextResponse } from 'next/server'
import { getSpellSuggestion } from '@/lib/services/spell-check.service'
import { checkRateLimit } from '@/lib/utils/rate-limit'

export async function GET(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, 'search')
  if (rateLimitResponse) return rateLimitResponse

  const query = (request.nextUrl.searchParams.get('q')?.trim() || '').slice(0, 200)

  if (query.length < 3) {
    return NextResponse.json({ suggestion: null })
  }

  try {
    const suggestion = await getSpellSuggestion(query)
    return NextResponse.json({ suggestion })
  } catch {
    return NextResponse.json({ suggestion: null })
  }
}
