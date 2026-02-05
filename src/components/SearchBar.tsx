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

  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} action="/search" method="get">
      <input
        type="search"
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className={styles.input}
        autoComplete="off"
      />
      <button type="submit" className={styles.button}>
        Search
      </button>
    </form>
  );
}
