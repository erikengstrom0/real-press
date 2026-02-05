import { SearchBar } from "@/components/SearchBar";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <div className={styles.logoWrapper}>
          <h1 className={styles.logo}>Real Press</h1>
        </div>
        <h2 className={styles.title}>
          A Search Engine for the <span className={styles.highlight}>Human</span> Web
        </h2>
        <p className={styles.subtitle}>
          In an age of AI-generated content, finding authentic human writing is harder than ever.
          Real Press analyzes web content and shows you a Human Score for every result,
          so you can discover genuine voices and original thinking.
        </p>

        <div className={styles.searchWrapper}>
          <SearchBar />
        </div>

        <div className={styles.actions}>
          <Link href="/submit" className={styles.submitLink}>
            or submit a URL to analyze
          </Link>
        </div>
      </div>

      <div className={styles.featuresDivider} />
      <div className={styles.features}>
        <div className={styles.feature}>
          <h3 className={styles.featureTitle}>Search Indexed Content</h3>
          <p className={styles.featureDesc}>
            Find articles, blog posts, and web pages that have been analyzed for AI content.
          </p>
        </div>

        <div className={styles.feature}>
          <h3 className={styles.featureTitle}>Human Score on Every Result</h3>
          <p className={styles.featureDesc}>
            See at a glance how likely content is human-written with our color-coded badges.
          </p>
        </div>

        <div className={styles.feature}>
          <h3 className={styles.featureTitle}>Submit Any URL</h3>
          <p className={styles.featureDesc}>
            Add content to our index instantly. We analyze it and show you the human score.
          </p>
        </div>
      </div>

      <div className={styles.footerDivider} />
      <footer className={styles.footer}>
        <p className={styles.footerText}>Real Press — Finding authentic content in the age of AI</p>
      </footer>
    </main>
  );
}
