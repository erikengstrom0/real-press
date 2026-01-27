import { SearchBar } from "@/components/SearchBar";
import { SearchResults } from "@/components/SearchResults";
import type { SearchResult } from "@/app/api/search/route";

interface SearchPageProps {
  searchParams: { q?: string };
}

async function getSearchResults(query: string): Promise<SearchResult[]> {
  if (!query) return [];

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.results;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || "";
  const results = await getSearchResults(query);

  return (
    <main style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "2rem" }}>
        <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Real Press</h1>
        </a>
        <SearchBar defaultValue={query} />
      </header>

      <section>
        {query ? (
          <SearchResults results={results} query={query} />
        ) : (
          <p style={{ color: "#666" }}>Enter a search query to get started.</p>
        )}
      </section>
    </main>
  );
}
