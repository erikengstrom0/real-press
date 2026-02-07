'use client'

import styles from './BreakdownTeaser.module.css'

/* ── Local type definitions ── */

interface BreakdownTeaserProps {
  previewData?: {
    explanation?: string
    providerAgreement?: 'agree' | 'mixed' | 'disagree'
  }
}

/* ── Component ── */

export function BreakdownTeaser({ previewData }: BreakdownTeaserProps) {
  const agreementLabel =
    previewData?.providerAgreement === 'disagree'
      ? 'Providers Disagree'
      : previewData?.providerAgreement === 'mixed'
        ? 'Mixed Signals'
        : 'Providers Agree'

  return (
    <div className={styles.container}>
      {/* Blurred fake preview content */}
      <div className={styles.blurredPreview} aria-hidden="true">
        <div className={styles.fakeHeader}>Why This Score?</div>
        <div className={styles.fakeRule} />
        <div className={styles.fakeText}>
          {previewData?.explanation ||
            'This article scored as Verified Authentic. All detection providers agreed on the classification based on multiple analysis signals.'}
        </div>
        <div className={styles.fakeSection}>
          <div className={styles.fakeBadge}>{agreementLabel}</div>
          <div className={styles.fakeList}>
            <div className={styles.fakeListItem} />
            <div className={styles.fakeListItem} />
          </div>
        </div>
        <div className={styles.fakeSection}>
          <div className={styles.fakeRadar} />
        </div>
        <div className={styles.fakeSection}>
          <div className={styles.fakeBar} />
        </div>
      </div>

      {/* Overlay CTA */}
      <div className={styles.overlay}>
        <div className={styles.overlayCard}>
          <h4 className={styles.overlayHeader}>See the Full Analysis</h4>
          <ul className={styles.featureList}>
            <li>Provider agreement details</li>
            <li>Writing style analysis</li>
            <li>Per-image scores</li>
            <li>Score breakdown by modality</li>
          </ul>
          <a href="/pricing" className={styles.ctaButton}>
            Upgrade to Pro
          </a>
        </div>
      </div>
    </div>
  )
}

/*
 * Example mock props:
 * {
 *   previewData: {
 *     explanation: 'This article scored as Verified Authentic.',
 *     providerAgreement: 'agree',
 *   },
 * }
 */
