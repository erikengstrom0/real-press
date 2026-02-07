/**
 * Content Detail Page
 *
 * Shows a single content item with its AI detection score
 * and explainability breakdown (for Pro users) or teaser (for free users).
 */

import prisma from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import { AIScoreBadge } from '@/components/AIScoreBadge'
import { ContentBreakdownSection } from './ContentBreakdownSection'
import styles from './page.module.css'
import type { Classification } from '@/lib/ai-detection/types'

interface ContentPageProps {
  params: Promise<{ id: string }>
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { id } = await params

  const content = await prisma.content.findUnique({
    where: { id },
    include: {
      aiScore: true,
      authorRef: true,
    },
  })

  if (!content) {
    notFound()
  }

  const aiScore = content.aiScore
  const humanScore = aiScore
    ? Math.round((1 - aiScore.compositeScore) * 100)
    : null

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          Real Press
        </a>
        <p className={styles.tagline}>Content Analysis</p>
      </header>

      <article className={styles.article}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <a
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.titleLink}
            >
              {content.title || 'Untitled'}
            </a>
          </h1>
          {aiScore && (
            <AIScoreBadge
              score={aiScore.compositeScore}
              classification={aiScore.classification as Classification}
              showScore
              size="large"
            />
          )}
        </div>

        <div className={styles.meta}>
          <span className={styles.domain}>{content.domain}</span>
          {content.authorRef && (
            <span className={styles.author}>by {content.authorRef.name}</span>
          )}
          {content.publishedAt && (
            <time className={styles.date}>
              {new Date(content.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>

        {content.description && (
          <p className={styles.description}>{content.description}</p>
        )}

        <div className={styles.divider} />

        {aiScore && (
          <div className={styles.scoreSection}>
            <h2 className={styles.sectionTitle}>Detection Analysis</h2>
            <div className={styles.scoreDetails}>
              <div className={styles.scoreStat}>
                <span className={styles.scoreLabel}>Human Score</span>
                <span className={styles.scoreValue}>{humanScore}%</span>
              </div>
              <div className={styles.scoreStat}>
                <span className={styles.scoreLabel}>Classification</span>
                <span className={styles.scoreValue}>
                  {formatClassification(aiScore.classification)}
                </span>
              </div>
              {aiScore.analyzedTypes.length > 0 && (
                <div className={styles.scoreStat}>
                  <span className={styles.scoreLabel}>Analyzed</span>
                  <span className={styles.scoreValue}>
                    {aiScore.analyzedTypes.join(', ') || 'text'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {aiScore && (
          <ContentBreakdownSection
            contentId={content.id}
            hasExplainability={aiScore.providerDetails !== null}
          />
        )}
      </article>
    </main>
  )
}

function formatClassification(classification: string): string {
  const labels: Record<string, string> = {
    human: 'Human',
    likely_human: 'Likely Human',
    unsure: 'Unsure',
    likely_ai: 'Likely AI',
    ai: 'AI Generated',
  }
  return labels[classification] ?? classification
}
