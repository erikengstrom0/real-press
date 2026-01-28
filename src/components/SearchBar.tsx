"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./SearchBar.module.css";

interface SearchBarProps {
  defaultValue?: string;
}

export function SearchBar({ defaultValue = "" }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className={styles.input}
      />
      <button type="submit" className={styles.button} disabled={!query.trim()}>
        Search
      </button>
    </form>
  );
}
