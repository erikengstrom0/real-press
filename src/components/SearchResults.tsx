import type { SearchResult } from "@/app/api/search/route";
import styles from "./SearchResults.module.css";

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
}

export function SearchResults({ results, query }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No results found for &ldquo;{query}&rdquo;</p>
      </div>
    );
  }

  return (
    <div className={styles.results}>
      <p className={styles.count}>
        {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
      </p>
      <ul className={styles.list}>
        {results.map((result) => (
          <li key={result.id} className={styles.item}>
            <a href={result.url} className={styles.link}>
              <h3 className={styles.title}>{result.title}</h3>
              <p className={styles.description}>{result.description}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
