'use client'

import styles from './ProviderAgreement.module.css'

/* ── Local type definitions ── */

interface ProviderDetail {
  name: string
  type: string
  score: number
  confidence: number
  isPrimary: boolean
}

interface ProviderAgreementProps {
  agreement: 'agree' | 'mixed' | 'disagree'
  providers: Array<ProviderDetail>
}

const AGREEMENT_CONFIG = {
  agree: { label: 'Providers Agree', className: 'agree' },
  mixed: { label: 'Mixed Signals', className: 'mixed' },
  disagree: { label: 'Providers Disagree', className: 'disagree' },
} as const

export function ProviderAgreement({ agreement, providers }: ProviderAgreementProps) {
  const config = AGREEMENT_CONFIG[agreement]

  return (
    <div className={styles.container}>
      <div className={`${styles.badge} ${styles[config.className]}`}>
        {config.label}
      </div>

      <ul className={styles.providerList}>
        {providers.map((provider) => (
          <li
            key={`${provider.name}-${provider.type}`}
            className={styles.providerItem}
          >
            <span className={styles.providerName}>{provider.name}</span>
            <span className={styles.providerType}>{provider.type}</span>
            <span className={styles.providerScore}>
              {Math.round((1 - provider.score) * 100)}% Human
            </span>
            {provider.isPrimary && (
              <span className={styles.primaryTag}>Primary</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/*
 * Example mock props:
 * {
 *   agreement: 'agree',
 *   providers: [
 *     { name: 'huggingface', type: 'text', score: 0.12, confidence: 0.91, isPrimary: true },
 *     { name: 'heuristic', type: 'text', score: 0.18, confidence: 0.72, isPrimary: false },
 *   ],
 * }
 */
