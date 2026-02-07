"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import styles from "./page.module.css"

const tierLabels: Record<string, string> = {
  FREE: "Free",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <main className={styles.main}>
        <p className={styles.loading}>Loading...</p>
      </main>
    )
  }

  if (!session?.user) {
    return null
  }

  const tier = (session.user as { tier?: string }).tier || "FREE"

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Your Account</h1>
          <p className={styles.subtitle}>Manage your Real Press profile</p>
        </div>

        <div className={styles.divider} />

        <div className={styles.info}>
          <div className={styles.row}>
            <span className={styles.label}>Name</span>
            <span className={styles.value}>{session.user.name || "Not set"}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Email</span>
            <span className={styles.value}>{session.user.email}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Your Tier</span>
            <span className={styles.tierBadge}>{tierLabels[tier] || tier}</span>
          </div>
        </div>

        {tier === "FREE" && (
          <div className={styles.upgradeNotice}>
            <p className={styles.upgradeText}>
              Upgrade to <strong>Pro</strong> for full AI detection breakdowns, provider details, and heuristic analysis.
            </p>
            <p className={styles.upgradeHint}>Upgrade options coming soon.</p>
          </div>
        )}

        <div className={styles.divider} />

        <div className={styles.apiKeyLink}>
          <Link href="/profile/api-keys" className={styles.apiKeyBtn}>
            Manage API Keys
          </Link>
          <p className={styles.apiKeyHint}>
            Generate keys for the public verification API
          </p>
        </div>

        <div className={styles.divider} />

        <div className={styles.actions}>
          <button
            className={styles.signOutBtn}
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign Out
          </button>
          <Link href="/" className={styles.homeLink}>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
