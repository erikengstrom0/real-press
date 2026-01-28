"use client";

import { useState } from "react";
import styles from "./SubmitForm.module.css";

interface SubmissionResult {
  success: boolean;
  message: string;
  contentId?: string;
}

export function SubmitForm() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: "URL submitted successfully! Content has been extracted and stored.",
          contentId: data.contentId,
        });
        setUrl("");
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to submit URL",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "Network error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isValidUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  const canSubmit = url.trim() && isValidUrl(url.trim()) && !isLoading;

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter a URL (e.g., https://example.com/article)"
          className={styles.input}
          disabled={isLoading}
        />
        <button
          type="submit"
          className={styles.button}
          disabled={!canSubmit}
        >
          {isLoading ? "Submitting..." : "Submit URL"}
        </button>
      </form>

      {result && (
        <div
          className={`${styles.result} ${
            result.success ? styles.success : styles.error
          }`}
        >
          {result.message}
        </div>
      )}

      <p className={styles.helpText}>
        Submit any article, blog post, or web page to have it analyzed for AI-generated content.
      </p>
    </div>
  );
}
