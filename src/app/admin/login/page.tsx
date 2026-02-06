'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'

export default function AdminLoginPage() {
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
      // Test the token by making a request to an admin endpoint
      const res = await fetch('/api/admin/crawl/jobs?stats=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (res.ok) {
        // Set cookie and redirect
        document.cookie = `admin_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`
        router.push(redirect)
      } else {
        setError('Invalid admin token')
      }
    } catch (err) {
      setError('Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.main}>
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
    </main>
  )
}
