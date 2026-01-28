import { SearchBar } from "@/components/SearchBar";
import Link from "next/link";

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
      <Link
        href="/submit"
        style={{
          marginTop: "1.5rem",
          color: "#0070f3",
          textDecoration: "none",
        }}
      >
        Submit a URL
      </Link>
    </main>
  );
}
