"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import styles from "./page.module.css"

interface QuotaStatus {
  tier: string
  used: number
  limit: number
  remaining: number
  resetsAt: string
  percentUsed: number
}

const tierLabels: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
}

export default function UsagePage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/user/quota")
      if (!res.ok) {
        throw new Error("Failed to fetch quota")
      }
      const data = await res.json()
      setQuota(data)
    } catch {
      setError("Could not load quota information.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login")
    }
  }, [sessionStatus, router])

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchQuota()
    }
  }, [sessionStatus, fetchQuota])

  if (sessionStatus === "loading" || loading) {
    return (
      <main className={styles.main}>
        <p className={styles.loading}>Loading...</p>
      </main>
    )
  }

  if (!session?.user) {
    return null
  }

  const resetDate = quota?.resetsAt
    ? new Date(quota.resetsAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—"

  const fillClass = quota
    ? quota.percentUsed >= 100
      ? `${styles.quotaFill} ${styles.quotaFillExhausted}`
      : quota.percentUsed >= 80
        ? `${styles.quotaFill} ${styles.quotaFillWarning}`
        : styles.quotaFill
    : styles.quotaFill

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>API Usage</h1>
          <p className={styles.subtitle}>Monitor your monthly verification API quota</p>
        </div>

        <div className={styles.divider} />

        {error && (
          <div className={styles.error}>
            <p>{error}</p>
          </div>
        )}

        {quota && (
          <div className={styles.quotaSection}>
            <div className={styles.quotaHeader}>
              <h2 className={styles.quotaTitle}>Monthly Quota</h2>
              <span className={styles.quotaTier}>
                {tierLabels[quota.tier] || quota.tier}
              </span>
            </div>

            <div className={styles.quotaBar}>
              <div
                className={fillClass}
                style={{ width: `${Math.min(quota.percentUsed, 100)}%` }}
              />
            </div>

            <div className={styles.quotaStats}>
              <span className={styles.quotaCount}>
                <strong>{quota.used.toLocaleString()}</strong> / {quota.limit.toLocaleString()} requests used
              </span>
              <span className={styles.quotaPercent}>{quota.percentUsed}%</span>
            </div>

            <p className={styles.quotaReset}>
              {quota.remaining.toLocaleString()} remaining — resets {resetDate}
            </p>

            {quota.percentUsed >= 100 && (
              <div className={styles.quotaExhausted}>
                <p>
                  Your monthly quota is exhausted. API requests will be rejected until your quota resets.
                  Upgrade your plan for more requests.
                </p>
              </div>
            )}

            {quota.percentUsed >= 80 && quota.percentUsed < 100 && (
              <div className={styles.quotaWarning}>
                <p>
                  You have used {quota.percentUsed}% of your monthly quota.
                  Consider upgrading your plan if you need more requests.
                </p>
              </div>
            )}
          </div>
        )}

        <div className={styles.divider} />

        <div className={styles.nav}>
          <Link href="/profile" className={styles.navLink}>Account</Link>
          <Link href="/profile/api-keys" className={styles.navLink}>API Keys</Link>
          <Link href="/" className={styles.navLink}>Home</Link>
        </div>
      </div>
    </main>
  )
}
