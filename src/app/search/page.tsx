import { SearchBar } from "@/components/SearchBar";

interface SearchPageProps {
  searchParams: { q?: string };
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || "";

  return (
    <main style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Real Press</h1>
        <SearchBar defaultValue={query} />
      </header>

      <section>
        {query ? (
          <div>
            <p style={{ color: "#666", marginBottom: "1rem" }}>
              Results for: <strong>{query}</strong>
            </p>
            {/* Search results will be rendered here */}
            <p style={{ color: "#999" }}>
              Search functionality coming soon...
            </p>
          </div>
        ) : (
          <p style={{ color: "#666" }}>Enter a search query to get started.</p>
        )}
      </section>
    </main>
  );
}
