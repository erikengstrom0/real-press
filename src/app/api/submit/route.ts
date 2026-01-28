import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractContent, ExtractionError } from '@/lib/services/extraction.service'
import { contentExists, createContentFromExtraction } from '@/lib/services/content.service'

const submitSchema = z.object({
  url: z.string().url('Please provide a valid URL'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = submitSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { url } = validation.data

    const exists = await contentExists(url)
    if (exists) {
      return NextResponse.json(
        { error: 'This URL has already been submitted' },
        { status: 409 }
      )
    }

    const extracted = await extractContent(url)

    const content = await createContentFromExtraction(extracted)

    return NextResponse.json({
      success: true,
      contentId: content.id,
      message: 'Content submitted successfully',
    })
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
