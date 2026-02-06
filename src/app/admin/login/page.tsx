'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'

function LoginForm() {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/admin/import'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Authenticate via server-side route (sets httpOnly secure cookie)
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (res.ok) {
        router.push(redirect)
      } else {
        setError('Invalid admin token')
      }
    } catch {
      setError('Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Admin Access</h1>
      <p className={styles.description}>
        Enter your admin token to access the admin area.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          className={styles.input}
          autoFocus
        />

        {error && <p className={styles.error}>{error}</p>}

        <button
          type="submit"
          className={styles.button}
          disabled={loading || !token}
        >
          {loading ? 'Verifying...' : 'Login'}
        </button>
      </form>

      <p className={styles.hint}>
        The admin token is set via the ADMIN_SECRET environment variable.
      </p>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <main className={styles.main}>
      <Suspense fallback={
        <div className={styles.card}>
          <h1 className={styles.title}>Admin Access</h1>
          <p className={styles.description}>Loading...</p>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </main>
  )
}
