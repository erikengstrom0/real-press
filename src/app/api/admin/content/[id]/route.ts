import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { logAdminAction } from '@/lib/services/audit.service'

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Fetch content details before deletion for audit log
    const contentToDelete = await prisma.content.findUnique({
      where: { id },
      select: {
        id: true,
        url: true,
        title: true,
        domain: true,
      },
    })

    if (!contentToDelete) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    // Prisma cascade deletes handle AiScore, ContentMedia, MediaScore, ContentTopic
    const deleted = await prisma.content.delete({
      where: { id },
    })

    // Log the action (fire-and-forget)
    void logAdminAction({
      action: 'content.delete',
      resourceType: 'content',
      resourceId: deleted.id,
      metadata: {
        url: contentToDelete.url,
        title: contentToDelete.title,
        domain: contentToDelete.domain,
      },
    })

    return NextResponse.json({ deleted: true, id: deleted.id })
  } catch (error) {
    // Prisma throws P2025 when record not found
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    console.error('Delete content error:', error)
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 })
  }
}
