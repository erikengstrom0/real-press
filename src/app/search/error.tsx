'use client'

import { ErrorMessage } from '@/components/ErrorMessage'
import styles from './page.module.css'

export default function SearchError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          Real Press
        </a>
        <p className={styles.tagline}>Search the Human Web</p>
      </header>

      <section className={styles.content}>
        <ErrorMessage
          title="Search failed"
          message="We couldn't complete your search. Please try again."
          onRetry={reset}
        />
      </section>
    </main>
  )
}
