"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import styles from "./SubmitForm.module.css";
import { normalizeUrl } from "@/lib/utils/url";
import { AIScoreBadge } from "./AIScoreBadge";
import type { Classification } from "@/lib/ai-detection";

type SubmitState =
  | "idle"
  | "submitting"
  | "queued"
  | "processing"
  | "complete"
  | "error";

interface SubmissionResult {
  success: boolean;
  message: string;
  contentId?: string;
  normalizedUrl?: string;
  title?: string;
  alreadyExists?: boolean;
  aiScore?: {
    score: number;
    classification: string;
  };
}

interface QueueStatus {
  position?: number;
  stage?: string;
  progress?: number;
}

const STAGE_LABELS: Record<string, string> = {
  extracting: "Extracting content...",
  analyzing: "Running AI detection...",
  complete: "Complete!",
};

const POLL_INTERVAL = 2000;

export function SubmitForm() {
  const [url, setUrl] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  // Normalize URL as user types to provide real-time feedback
  const normalizeResult = useMemo(() => {
    if (!url.trim()) return null;
    return normalizeUrl(url);
  }, [url]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    jobIdRef.current = null;
  }, []);

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollStatus = useCallback(
    async (jobId: string) => {
      try {
        const response = await fetch(`/api/submit/status/${jobId}`);
        if (!response.ok) {
          stopPolling();
          setSubmitState("error");
          setErrorMessage("Failed to check submission status");
          return;
        }

        const data = await response.json();

        switch (data.status) {
          case "queued":
            setSubmitState("queued");
            setQueueStatus({ position: data.position });
            break;

          case "processing":
            setSubmitState("processing");
            setQueueStatus({
              stage: data.stage,
              progress: data.progress,
            });
            break;

          case "completed":
            stopPolling();
            setSubmitState("complete");
            setResult({
              success: true,
              message: "Content submitted and analyzed successfully!",
              contentId: data.contentId,
              aiScore: data.aiScore,
            });
            setUrl("");
            break;

          case "failed":
            stopPolling();
            setSubmitState("error");
            setErrorMessage(data.error || "Processing failed");
            break;
        }
      } catch {
        stopPolling();
        setSubmitState("error");
        setErrorMessage("Network error while checking status");
      }
    },
    [stopPolling]
  );

  const startPolling = useCallback(
    (jobId: string) => {
      jobIdRef.current = jobId;
      // Poll immediately, then on interval
      pollStatus(jobId);
      pollRef.current = setInterval(() => pollStatus(jobId), POLL_INTERVAL);
    },
    [pollStatus]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || submitState === "submitting") return;

    // Normalize the URL before submission
    const normalized = normalizeUrl(url);
    if (!normalized.success) {
      setResult({
        success: false,
        message: `${normalized.error}. ${normalized.hint}`,
      });
      return;
    }

    setSubmitState("submitting");
    setResult(null);
    setErrorMessage(null);
    setQueueStatus({});

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized.url }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.async) {
          // Async path: start polling for status
          setSubmitState("queued");
          setQueueStatus({ position: data.position });
          startPolling(data.jobId);
        } else {
          // Sync path: result is already available
          setSubmitState("complete");
          setResult({
            success: true,
            message: "URL submitted and analyzed successfully!",
            contentId: data.contentId,
            normalizedUrl: normalized.url,
            aiScore: data.aiScore,
          });
          setUrl("");
        }
      } else if (response.status === 409 && data.exists) {
        // URL already exists - show the existing analysis
        setSubmitState("complete");
        setResult({
          success: true,
          alreadyExists: true,
          message: "This URL has already been analyzed.",
          contentId: data.contentId,
          normalizedUrl: data.url,
          title: data.title,
          aiScore: data.aiScore,
        });
        setUrl("");
      } else {
        setSubmitState("error");
        setErrorMessage(data.error || "Failed to submit URL");
      }
    } catch {
      setSubmitState("error");
      setErrorMessage("Network error. Please try again.");
    }
  };

  const handleRetry = () => {
    setSubmitState("idle");
    setResult(null);
    setErrorMessage(null);
    setQueueStatus({});
  };

  const isActive =
    submitState === "submitting" ||
    submitState === "queued" ||
    submitState === "processing";

  const canSubmit = normalizeResult?.success && !isActive;

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
      return null;
    } else {
      return {
        type: "error" as const,
        message: `${normalizeResult.error}. ${normalizeResult.hint}`,
      };
    }
  };

  const inputHint = getInputHint();

  const getButtonText = () => {
    switch (submitState) {
      case "submitting":
        return "Submitting...";
      case "queued":
      case "processing":
        return "Processing...";
      default:
        return "Submit URL";
    }
  };

  const getProgressLabel = () => {
    if (submitState === "queued" && queueStatus.position) {
      return `Queued (position #${queueStatus.position})...`;
    }
    if (submitState === "processing" && queueStatus.stage) {
      return STAGE_LABELS[queueStatus.stage] || "Processing...";
    }
    if (submitState === "submitting") {
      return "Submitting...";
    }
    return null;
  };

  const progressPercent =
    submitState === "submitting"
      ? 5
      : submitState === "queued"
        ? 10
        : queueStatus.progress || 0;

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setResult(null);
            setErrorMessage(null);
            if (submitState === "error" || submitState === "complete") {
              setSubmitState("idle");
            }
          }}
          placeholder="Enter a URL (e.g., example.com or https://example.com/article)"
          className={`${styles.input} ${inputHint?.type === "error" ? styles.inputError : ""}`}
          disabled={isActive}
        />
        <button
          type="submit"
          className={styles.button}
          disabled={!canSubmit}
        >
          {getButtonText()}
        </button>
      </form>

      {inputHint && !result && !errorMessage && (
        <div
          className={`${styles.hint} ${
            inputHint.type === "error" ? styles.hintError : styles.hintInfo
          }`}
        >
          {inputHint.message}
        </div>
      )}

      {isActive && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className={styles.progressStage}>{getProgressLabel()}</p>
        </div>
      )}

      {submitState === "error" && errorMessage && (
        <div className={`${styles.result} ${styles.error}`}>
          <p>{errorMessage}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={handleRetry}
          >
            Try Again
          </button>
        </div>
      )}

      {submitState === "complete" && result && (
        <div
          className={`${styles.result} ${
            result.success
              ? result.alreadyExists
                ? styles.info
                : styles.success
              : styles.error
          }`}
        >
          <p>{result.message}</p>
          {result.success && result.title && (
            <p className={styles.resultDetail}>
              <strong>{result.title}</strong>
            </p>
          )}
          {result.success && result.normalizedUrl && (
            <p className={styles.resultDetail}>
              <a
                href={result.normalizedUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.normalizedUrl}
              </a>
            </p>
          )}
          {result.success && result.contentId && (
            <p className={styles.resultDetail}>
              <a href={`/content/${result.contentId}`}>
                View full analysis
              </a>
            </p>
          )}
          {result.success && result.aiScore && (
            <div
              className={styles.resultDetail}
              style={{ marginTop: "1rem" }}
            >
              <AIScoreBadge
                score={result.aiScore.score}
                classification={
                  result.aiScore.classification as Classification
                }
                showScore
                size="large"
              />
            </div>
          )}
        </div>
      )}

      <p className={styles.helpText}>
        Submit any article, blog post, or web page to have it analyzed for
        AI-generated content. You can enter just the domain (like{" "}
        <code>example.com</code>) or the full URL.
      </p>
    </div>
  );
}
