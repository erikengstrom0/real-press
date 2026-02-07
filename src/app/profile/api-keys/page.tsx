"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import styles from "./page.module.css"

interface ApiKey {
  id: string
  keyPrefix: string
  name: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

interface NewKeyResult {
  id: string
  keyPrefix: string
  name: string
  rawKey: string
  createdAt: string
}

export default function ApiKeysPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState("")
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/user/api-keys")
      if (res.ok) {
        const data = await res.json()
        setKeys(data.keys)
      }
    } catch {
      setError("Failed to load API keys")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") {
      fetchKeys()
    }
  }, [status, fetchKeys])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newKeyName.trim()) return

    setCreating(true)
    setError(null)

    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create key")
      }

      const data: NewKeyResult = await res.json()
      setNewKey(data)
      setNewKeyName("")
      fetchKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key")
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) {
      return
    }

    setRevoking(keyId)
    setError(null)

    try {
      const res = await fetch("/api/user/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to revoke key")
      }

      fetchKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key")
    } finally {
      setRevoking(null)
    }
  }

  async function handleCopy() {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey.rawKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea")
      textarea.value = newKey.rawKey
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (status === "loading" || loading) {
    return (
      <main className={styles.main}>
        <p className={styles.loading}>Loading...</p>
      </main>
    )
  }

  if (!session?.user) {
    return null
  }

  const activeKeys = keys.filter((k) => !k.revokedAt)
  const revokedKeys = keys.filter((k) => k.revokedAt)

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>API Keys</h1>
          <p className={styles.subtitle}>
            Manage your API keys for the verification API
          </p>
        </div>

        <div className={styles.divider} />

        {error && (
          <div className={styles.error}>
            <p>{error}</p>
          </div>
        )}

        {/* New key banner (shown once after creation) */}
        {newKey && (
          <div className={styles.newKeyBanner}>
            <p className={styles.newKeyWarning}>
              Copy your API key now. It will not be shown again.
            </p>
            <div className={styles.newKeyRow}>
              <code className={styles.newKeyValue}>{newKey.rawKey}</code>
              <button className={styles.copyBtn} onClick={handleCopy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              className={styles.dismissBtn}
              onClick={() => setNewKey(null)}
            >
              I&apos;ve saved this key
            </button>
          </div>
        )}

        {/* Create form */}
        <form onSubmit={handleCreate} className={styles.createForm}>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. My App)"
            className={styles.nameInput}
            maxLength={100}
          />
          <button
            type="submit"
            className={styles.createBtn}
            disabled={creating || !newKeyName.trim()}
          >
            {creating ? "Creating..." : "Create Key"}
          </button>
        </form>

        <div className={styles.divider} />

        {/* Active keys */}
        <h2 className={styles.sectionTitle}>Active Keys</h2>
        {activeKeys.length === 0 ? (
          <p className={styles.empty}>No active API keys.</p>
        ) : (
          <div className={styles.keyList}>
            {activeKeys.map((key) => (
              <div key={key.id} className={styles.keyItem}>
                <div className={styles.keyInfo}>
                  <span className={styles.keyName}>{key.name}</span>
                  <code className={styles.keyPrefixCode}>{key.keyPrefix}...</code>
                  <span className={styles.keyDate}>
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && (
                      <> &middot; Last used {new Date(key.lastUsedAt).toLocaleDateString()}</>
                    )}
                  </span>
                </div>
                <button
                  className={styles.revokeBtn}
                  onClick={() => handleRevoke(key.id)}
                  disabled={revoking === key.id}
                >
                  {revoking === key.id ? "Revoking..." : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Revoked keys */}
        {revokedKeys.length > 0 && (
          <>
            <div className={styles.divider} />
            <h2 className={styles.sectionTitle}>Revoked Keys</h2>
            <div className={styles.keyList}>
              {revokedKeys.map((key) => (
                <div key={key.id} className={`${styles.keyItem} ${styles.revoked}`}>
                  <div className={styles.keyInfo}>
                    <span className={styles.keyName}>{key.name}</span>
                    <code className={styles.keyPrefixCode}>{key.keyPrefix}...</code>
                    <span className={styles.keyDate}>
                      Revoked {new Date(key.revokedAt!).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.divider} />

        <div className={styles.nav}>
          <Link href="/profile" className={styles.navLink}>
            Back to Profile
          </Link>
          <Link href="/" className={styles.navLink}>
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
