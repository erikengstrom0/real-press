"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import styles from "./page.module.css"

const tierLabels: Record<string, string> = {
  FREE: "Free",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
}

function ProfileContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [billingLoading, setBillingLoading] = useState(false)

  const billingStatus = searchParams.get("billing")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading") {
    return <p className={styles.loading}>Loading...</p>
  }

  if (!session?.user) {
    return null
  }

  const tier = (session.user as { tier?: string }).tier || "FREE"

  async function handleUpgrade() {
    setBillingLoading(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || "Failed to start checkout")
        setBillingLoading(false)
      }
    } catch {
      alert("Failed to start checkout")
      setBillingLoading(false)
    }
  }

  async function handleManageSubscription() {
    setBillingLoading(true)
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || "Failed to open billing portal")
        setBillingLoading(false)
      }
    } catch {
      alert("Failed to open billing portal")
      setBillingLoading(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>Your Account</h1>
        <p className={styles.subtitle}>Manage your Real Press profile</p>
      </div>

      {billingStatus === "success" && (
        <div className={styles.billingSuccess}>
          Subscription activated! Your account has been upgraded.
        </div>
      )}

      {billingStatus === "cancel" && (
        <div className={styles.billingCancel}>
          Checkout canceled. No changes were made to your account.
        </div>
      )}

      <div className={styles.divider} />

        <div className={styles.apiKeyLink}>
          <Link href="/profile/usage" className={styles.apiKeyBtn}>
            View API Usage
          </Link>
          <p className={styles.apiKeyHint}>
            Monitor your monthly quota and request history
          </p>
        </div>

        <div className={styles.divider} />

        <div className={styles.actions}>
          <button
            className={styles.upgradeBtn}
            onClick={handleUpgrade}
            disabled={billingLoading}
          >
            {billingLoading ? "Redirecting..." : "Upgrade to Pro"}
          </button>
        </div>
      ) : (
        <div className={styles.subscriptionInfo}>
          <p className={styles.subscriptionText}>
            You are on the <strong>{tierLabels[tier]}</strong> plan.
          </p>
          <button
            className={styles.manageBtn}
            onClick={handleManageSubscription}
            disabled={billingLoading}
          >
            {billingLoading ? "Redirecting..." : "Manage Subscription"}
          </button>
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.linkSection}>
        <Link href="/profile/api-keys" className={styles.apiKeyBtn}>
          Manage API Keys
        </Link>
        <p className={styles.linkHint}>
          Generate keys for the public verification API
        </p>
      </div>

      <div className={styles.linkSection}>
        <Link href="/profile/usage" className={styles.usageBtn}>
          View API Usage
        </Link>
        <p className={styles.linkHint}>
          Track your API request history and usage stats
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
  )
}

export default function ProfilePage() {
  return (
    <main className={styles.main}>
      <Suspense fallback={<p className={styles.loading}>Loading...</p>}>
        <ProfileContent />
      </Suspense>
    </main>
  )
}
