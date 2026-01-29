"use client";

import { useState, useMemo } from "react";
import styles from "./SubmitForm.module.css";
import { normalizeUrl } from "@/lib/utils/url";

interface SubmissionResult {
  success: boolean;
  message: string;
  contentId?: string;
  normalizedUrl?: string;
  aiScore?: {
    score: number;
    classification: string;
  };
}

export function SubmitForm() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  // Normalize URL as user types to provide real-time feedback
  const normalizeResult = useMemo(() => {
    if (!url.trim()) return null;
    return normalizeUrl(url);
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;

    // Normalize the URL before submission
    const normalized = normalizeUrl(url);
    if (!normalized.success) {
      setResult({
        success: false,
        message: `${normalized.error}. ${normalized.hint}`,
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized.url }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: "URL submitted and analyzed successfully!",
          contentId: data.contentId,
          normalizedUrl: normalized.url,
          aiScore: data.aiScore,
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

  const canSubmit = normalizeResult?.success && !isLoading;

  // Determine what hint to show
  const getInputHint = () => {
    if (!url.trim()) return null;
    if (!normalizeResult) return null;

    if (normalizeResult.success) {
      if (normalizeResult.wasModified) {
        return {
          type: "info" as const,
          message: `Will submit as: ${normalizeResult.url}`,
        };
      }
      return null; // Valid URL, no modification needed
    } else {
      return {
        type: "error" as const,
        message: `${normalizeResult.error}. ${normalizeResult.hint}`,
      };
    }
  };

  const inputHint = getInputHint();

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setResult(null); // Clear previous result when typing
          }}
          placeholder="Enter a URL (e.g., example.com or https://example.com/article)"
          className={`${styles.input} ${inputHint?.type === "error" ? styles.inputError : ""}`}
          disabled={isLoading}
        />
        <button
          type="submit"
          className={styles.button}
          disabled={!canSubmit}
        >
          {isLoading ? "Analyzing..." : "Submit URL"}
        </button>
      </form>

      {inputHint && !result && (
        <div
          className={`${styles.hint} ${
            inputHint.type === "error" ? styles.hintError : styles.hintInfo
          }`}
        >
          {inputHint.message}
        </div>
      )}

      {result && (
        <div
          className={`${styles.result} ${
            result.success ? styles.success : styles.error
          }`}
        >
          <p>{result.message}</p>
          {result.success && result.normalizedUrl && (
            <p className={styles.resultDetail}>
              Analyzed: <a href={result.normalizedUrl} target="_blank" rel="noopener noreferrer">{result.normalizedUrl}</a>
            </p>
          )}
          {result.success && result.aiScore && (
            <p className={styles.resultDetail}>
              Human Score: {((1 - result.aiScore.score) * 100).toFixed(0)}% ({result.aiScore.classification})
            </p>
          )}
        </div>
      )}

      <p className={styles.helpText}>
        Submit any article, blog post, or web page to have it analyzed for AI-generated content.
        You can enter just the domain (like <code>example.com</code>) or the full URL.
      </p>
    </div>
  );
}
