"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import styles from "./page.module.css"

function LoginForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"
  const errorParam = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(
    errorParam === "CredentialsSignin"
      ? "Invalid email or password."
      : errorParam
        ? "An error occurred. Please try again."
        : ""
  )
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        setError("Invalid email or password.")
      } else if (result?.url) {
        window.location.href = result.url
      }
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <Link href="/" className={styles.logoLink}>
          Real Press
        </Link>

        <div className={styles.divider} />

        <h1 className={styles.title}>Log In</h1>
        <p className={styles.subtitle}>Access your Real Press account</p>

        {error && <p className={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={styles.input}
              placeholder="you@example.com"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={8}
              className={styles.input}
              placeholder="Min. 8 characters"
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className={styles.oauthSection}>
          <p className={styles.oauthLabel}>Or continue with</p>
          <div className={styles.oauthButtons}>
            <button
              type="button"
              className={styles.oauthBtn}
              onClick={() => signIn("google", { callbackUrl })}
            >
              Google
            </button>
            <button
              type="button"
              className={styles.oauthBtn}
              onClick={() => signIn("github", { callbackUrl })}
            >
              GitHub
            </button>
          </div>
        </div>

        <div className={styles.divider} />

        <p className={styles.switchText}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className={styles.switchLink}>
            Sign Up
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
