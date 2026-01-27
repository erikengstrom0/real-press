import { SearchBar } from "@/components/SearchBar";

export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "2rem" }}>Real Press</h1>
      <SearchBar />
    </main>
  );
}
