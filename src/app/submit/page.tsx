import { SubmitForm } from "@/components/SubmitForm";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Submit URL - Real Press",
  description: "Submit a URL to be analyzed for AI-generated content",
};

export default function SubmitPage() {
  return (
    <main className={styles.main}>
      <Link href="/" className={styles.backLink}>
        &larr; Back to Home
      </Link>

      <h1 className={styles.title}>Submit a URL</h1>
      <p className={styles.description}>
        Add content to Real Press for AI detection analysis. We&apos;ll extract
        the article and score it on the Human to AI spectrum.
      </p>

      <SubmitForm />
    </main>
  );
}
