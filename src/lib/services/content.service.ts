import prisma from '@/lib/db/prisma'
import type { ExtractedContent } from './extraction.service'

export interface CreateContentInput {
  url: string
  domain: string
  title: string | null
  description: string | null
  contentText: string
  contentHash: string
  sourceType?: string
}

export async function createContent(input: CreateContentInput) {
  return prisma.content.create({
    data: {
      url: input.url,
      domain: input.domain,
      title: input.title,
      description: input.description,
      contentText: input.contentText,
      contentHash: input.contentHash,
      sourceType: input.sourceType ?? 'user_submitted',
      status: 'pending',
    },
  })
}

export async function getContentByUrl(url: string) {
  return prisma.content.findUnique({
    where: { url },
    include: { aiScore: true },
  })
}

export async function getContentById(id: string) {
  return prisma.content.findUnique({
    where: { id },
    include: { aiScore: true },
  })
}

export async function contentExists(url: string): Promise<boolean> {
  const existing = await prisma.content.findUnique({
    where: { url },
    select: { id: true },
  })
  return existing !== null
}

export async function createContentFromExtraction(extracted: ExtractedContent) {
  return createContent({
    url: extracted.url,
    domain: extracted.domain,
    title: extracted.title,
    description: extracted.description,
    contentText: extracted.contentText,
    contentHash: extracted.contentHash,
  })
}
