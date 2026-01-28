import { SubmitForm } from "@/components/SubmitForm";
import Link from "next/link";

export const metadata = {
  title: "Submit URL - Real Press",
  description: "Submit a URL to be analyzed for AI-generated content",
};

export default function SubmitPage() {
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
      <Link
        href="/"
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          color: "#0070f3",
          textDecoration: "none",
        }}
      >
        &larr; Back to Home
      </Link>

      <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
        Submit a URL
      </h1>
      <p
        style={{
          color: "#666",
          marginBottom: "2rem",
          textAlign: "center",
          maxWidth: "500px",
        }}
      >
        Add content to Real Press for AI detection analysis. We&apos;ll extract
        the article and score it on the Human to AI spectrum.
      </p>

      <SubmitForm />
    </main>
  );
}
