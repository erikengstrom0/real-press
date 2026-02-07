"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { useState } from "react"
import styles from "./Header.module.css"

export default function Header() {
  const { data: session, status } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          Real Press
        </Link>

        <button
          className={styles.menuToggle}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          {menuOpen ? "\u2715" : "\u2630"}
        </button>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          <Link href="/search" className={styles.navLink} onClick={() => setMenuOpen(false)}>
            Search
          </Link>
          <Link href="/submit" className={styles.navLink} onClick={() => setMenuOpen(false)}>
            Submit
          </Link>

          <span className={styles.navDivider} />

          {status === "loading" ? (
            <span className={styles.navMuted}>...</span>
          ) : session?.user ? (
            <>
              <Link href="/profile" className={styles.navLink} onClick={() => setMenuOpen(false)}>
                {session.user.name || session.user.email}
              </Link>
              <button
                className={styles.logoutBtn}
                onClick={() => {
                  setMenuOpen(false)
                  signOut({ callbackUrl: "/" })
                }}
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.navLink} onClick={() => setMenuOpen(false)}>
                Log In
              </Link>
              <Link href="/signup" className={styles.signupLink} onClick={() => setMenuOpen(false)}>
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
