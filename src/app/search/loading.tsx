import { LoadingSpinner } from '@/components/LoadingSpinner'
import styles from './page.module.css'

export default function SearchLoading() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          Real Press
        </a>
        <p className={styles.tagline}>Search the Human Web</p>
      </header>

      <section className={styles.content}>
        <LoadingSpinner size="large" message="Searching..." />
      </section>
    </main>
  )
}
