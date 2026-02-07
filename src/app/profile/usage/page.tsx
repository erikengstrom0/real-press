"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import styles from "./page.module.css"

interface DailyUsage {
  date: string
  endpoint: string
  requestCount: number
  errorCount: number
}

interface UsageData {
  daily: DailyUsage[]
  totals: Record<string, number>
}

export default function UsagePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated") return

    setLoading(true)
    fetch(`/api/user/usage?days=${days}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch usage')
        return res.json()
      })
      .then(data => {
        setUsage(data.usage)
        setError(null)
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [status, days])

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <main className={styles.main}>
        <p className={styles.loading}>Loading usage data...</p>
      </main>
    )
  }

  if (!session?.user || error) {
    return (
      <main className={styles.main}>
        <div className={styles.card}>
          <p className={styles.error}>{error || "Unable to load usage data"}</p>
          <Link href="/profile" className={styles.backLink}>Back to Profile</Link>
        </div>
      </main>
    )
  }

  const totalRequests = usage?.totals?.total || 0
  const totalErrors = usage?.daily?.reduce((sum, d) => sum + d.errorCount, 0) || 0
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : '0'

  // Calculate today's requests
  const today = new Date().toISOString().split('T')[0]
  const todayRequests = usage?.daily
    ?.filter(d => d.date === today)
    ?.reduce((sum, d) => sum + d.requestCount, 0) || 0

  // Aggregate daily totals for chart
  const dailyTotals: Record<string, number> = {}
  usage?.daily?.forEach(d => {
    dailyTotals[d.date] = (dailyTotals[d.date] || 0) + d.requestCount
  })
  const dailyEntries = Object.entries(dailyTotals).sort((a, b) => a[0].localeCompare(b[0]))
  const maxDaily = Math.max(...Object.values(dailyTotals), 1)

  // Endpoint breakdown
  const endpointTotals: Record<string, number> = { ...usage?.totals }
  delete endpointTotals.total

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>API Usage</h1>
          <Link href="/profile" className={styles.backLink}>Back to Profile</Link>
        </div>

        <div className={styles.divider} />

        {/* Summary Cards */}
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Requests</span>
            <span className={styles.summaryValue}>{totalRequests.toLocaleString()}</span>
            <span className={styles.summaryPeriod}>Last {days} days</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Today</span>
            <span className={styles.summaryValue}>{todayRequests.toLocaleString()}</span>
            <span className={styles.summaryPeriod}>Requests today</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Error Rate</span>
            <span className={styles.summaryValue}>{errorRate}%</span>
            <span className={styles.summaryPeriod}>{totalErrors} errors</span>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Period Selector */}
        <div className={styles.periodSelector}>
          <span className={styles.periodLabel}>Period:</span>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              className={`${styles.periodBtn} ${days === d ? styles.periodBtnActive : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Daily Usage Chart */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Daily Requests</h2>
          {dailyEntries.length === 0 ? (
            <p className={styles.emptyText}>No usage data yet. Make some API requests to see your usage here.</p>
          ) : (
            <div className={styles.chart}>
              {dailyEntries.map(([date, count]) => (
                <div key={date} className={styles.chartBar}>
                  <div
                    className={styles.chartBarFill}
                    style={{ height: `${(count / maxDaily) * 100}%` }}
                  />
                  <span className={styles.chartBarLabel}>
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className={styles.chartBarValue}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className={styles.divider} />

        {/* Endpoint Breakdown */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>By Endpoint</h2>
          {Object.keys(endpointTotals).length === 0 ? (
            <p className={styles.emptyText}>No endpoint data available.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Requests</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(endpointTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([endpoint, count]) => (
                    <tr key={endpoint}>
                      <td><code>{endpoint}</code></td>
                      <td>{count.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  )
}
