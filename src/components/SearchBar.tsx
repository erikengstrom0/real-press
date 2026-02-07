"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SpellSuggestion } from "./SpellSuggestion";
import styles from "./SearchBar.module.css";

interface SearchBarProps {
  defaultValue?: string;
}

interface SuggestionState {
  original: string;
  suggested: string;
}

export function SearchBar({ defaultValue = "" }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [checking, setChecking] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);

  const navigateToSearch = (q: string) => {
    setSuggestion(null);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    // Skip spell check for very short queries
    if (trimmed.length < 3) {
      navigateToSearch(trimmed);
      return;
    }

    setChecking(true);
    setSuggestion(null);

    try {
      const res = await fetch(`/api/spell-check?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.suggestion) {
          setSuggestion({
            original: data.suggestion.original,
            suggested: data.suggestion.suggested,
          });
          setChecking(false);
          return; // Wait for user to pick
        }
      }
    } catch {
      // Spell check failure — just search normally
    }

    setChecking(false);
    navigateToSearch(trimmed);
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
    <div className={styles.wrapper}>
      <form onSubmit={handleSubmit} className={styles.form} action="/search" method="get">
        <input
          type="search"
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSuggestion(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className={styles.input}
          autoComplete="off"
          disabled={checking}
        />
        <button type="submit" className={styles.button} disabled={checking}>
          {checking ? "Checking..." : "Search"}
        </button>
      </form>

      {suggestion && (
        <SpellSuggestion
          original={suggestion.original}
          suggested={suggestion.suggested}
          onSearchOriginal={() => navigateToSearch(suggestion.original)}
          onSearchSuggested={() => navigateToSearch(suggestion.suggested)}
        />
      )}
    </div>
  );
}
