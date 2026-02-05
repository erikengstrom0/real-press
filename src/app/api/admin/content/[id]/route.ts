import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const content = await prisma.content.findUnique({
    where: { id },
    include: {
      aiScore: true,
      topics: {
        include: {
          topic: true,
        },
      },
      authorRef: true,
    },
  })

  if (!content) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  return NextResponse.json(content)
}
