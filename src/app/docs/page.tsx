import Link from "next/link"
import styles from "./page.module.css"

export default function DocsPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>API Documentation</h1>
        <p className={styles.subtitle}>
          Real Press Verification API — Detect AI-generated content in text, URLs, and images.
        </p>

        <div className={styles.divider} />

        {/* Authentication */}
        <h2 className={styles.sectionTitle}>Authentication</h2>
        <p className={styles.text}>
          All API requests require authentication via an API key. Include your key in the
          {" "}<code className={styles.inlineCode}>Authorization</code> header:
        </p>
        <code className={styles.code}>Authorization: Bearer rp_live_your_api_key_here</code>
        <p className={styles.text}>
          Generate API keys from your{" "}
          <Link href="/profile/api-keys">account settings</Link>.
        </p>

        <div className={styles.dividerThin} />

        {/* Base URL */}
        <h2 className={styles.sectionTitle}>Base URL</h2>
        <code className={styles.baseUrl}>https://www.real.press/api/v1</code>

        <div className={styles.dividerThin} />

        {/* Monthly Quotas */}
        <h2 className={styles.sectionTitle}>Monthly Quotas</h2>
        <p className={styles.text}>
          Each tier has a monthly request limit. When your quota is exhausted, the API returns
          {" "}<code className={styles.inlineCode}>429 Too Many Requests</code> until the quota resets
          on the first of the next month (UTC).
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tier</th>
              <th>Monthly Limit</th>
              <th>Rate Limit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Free</td>
              <td>100 requests/month</td>
              <td>30 requests/minute</td>
            </tr>
            <tr>
              <td>Pro</td>
              <td>5,000 requests/month</td>
              <td>30 requests/minute</td>
            </tr>
            <tr>
              <td>Enterprise</td>
              <td>50,000 requests/month</td>
              <td>30 requests/minute</td>
            </tr>
          </tbody>
        </table>
        <p className={styles.text}>
          For batch requests, each item in the batch counts as one request toward your monthly quota.
        </p>

        <h3 className={styles.subsectionTitle}>Quota Response Headers</h3>
        <p className={styles.text}>
          Every API response includes headers showing your current quota status:
        </p>
        <ul className={styles.headerList}>
          <li>
            <span className={styles.headerName}>X-Quota-Limit</span> — Your total monthly allowance
          </li>
          <li>
            <span className={styles.headerName}>X-Quota-Used</span> — Requests used this month
          </li>
          <li>
            <span className={styles.headerName}>X-Quota-Remaining</span> — Requests remaining this month
          </li>
          <li>
            <span className={styles.headerName}>X-Quota-Reset</span> — ISO 8601 date when quota resets
          </li>
        </ul>

        <h3 className={styles.subsectionTitle}>Quota Exceeded Response</h3>
        <code className={styles.code}>{`HTTP/1.1 429 Too Many Requests
X-Quota-Limit: 100
X-Quota-Used: 100
X-Quota-Remaining: 0
X-Quota-Reset: 2026-03-01T00:00:00.000Z

{
  "error": "Monthly API quota exceeded. Upgrade your plan for more requests."
}`}</code>

        <div className={styles.dividerThin} />

        {/* Endpoints */}
        <h2 className={styles.sectionTitle}>Endpoints</h2>

        {/* POST /verify/text */}
        <h3 className={styles.subsectionTitle}>POST /verify/text</h3>
        <p className={styles.text}>Verify text content for AI detection.</p>
        <code className={styles.code}>{`curl -X POST https://www.real.press/api/v1/verify/text \\
  -H "Authorization: Bearer rp_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Your text content to analyze (50-50000 chars)..."
  }'`}</code>

        {/* POST /verify/url */}
        <h3 className={styles.subsectionTitle}>POST /verify/url</h3>
        <p className={styles.text}>
          Extract content from a URL and verify it. Optionally extract media for multi-modal analysis.
        </p>
        <code className={styles.code}>{`curl -X POST https://www.real.press/api/v1/verify/url \\
  -H "Authorization: Bearer rp_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com/article",
    "extractMedia": false
  }'`}</code>

        {/* POST /verify/image */}
        <h3 className={styles.subsectionTitle}>POST /verify/image</h3>
        <p className={styles.text}>
          Verify an image for AI detection. Provide either an image URL or base64-encoded image.
        </p>
        <code className={styles.code}>{`curl -X POST https://www.real.press/api/v1/verify/image \\
  -H "Authorization: Bearer rp_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "imageUrl": "https://example.com/photo.jpg"
  }'`}</code>

        {/* POST /verify/batch */}
        <h3 className={styles.subsectionTitle}>POST /verify/batch</h3>
        <p className={styles.text}>
          Batch verification of multiple items. Each item counts as one request toward your quota.
          Maximum items per batch: Free (10), Pro (25), Enterprise (50).
        </p>
        <code className={styles.code}>{`curl -X POST https://www.real.press/api/v1/verify/batch \\
  -H "Authorization: Bearer rp_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      { "type": "text", "text": "First text to check..." },
      { "type": "url", "url": "https://example.com/article" },
      { "type": "image", "imageUrl": "https://example.com/photo.jpg" }
    ]
  }'`}</code>

        <div className={styles.dividerThin} />

        {/* Response Format */}
        <h2 className={styles.sectionTitle}>Response Format</h2>
        <p className={styles.text}>
          Free tier responses include a score, classification, and confidence level.
          Pro and Enterprise tiers receive a detailed breakdown with provider details,
          heuristic signals, and fusion weights.
        </p>

        <h3 className={styles.subsectionTitle}>Free Tier Response</h3>
        <code className={styles.code}>{`{
  "score": 0.23,
  "classification": "likely_human",
  "confidence": 0.85,
  "analyzedTypes": ["text"]
}`}</code>

        <h3 className={styles.subsectionTitle}>Classifications</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Score Range</th>
              <th>Classification</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>0.00 - 0.15</td>
              <td><code className={styles.inlineCode}>human</code></td>
              <td>Very likely written by a human</td>
            </tr>
            <tr>
              <td>0.15 - 0.35</td>
              <td><code className={styles.inlineCode}>likely_human</code></td>
              <td>Probably written by a human</td>
            </tr>
            <tr>
              <td>0.35 - 0.65</td>
              <td><code className={styles.inlineCode}>unsure</code></td>
              <td>Uncertain — could be either</td>
            </tr>
            <tr>
              <td>0.65 - 0.85</td>
              <td><code className={styles.inlineCode}>likely_ai</code></td>
              <td>Probably AI-generated</td>
            </tr>
            <tr>
              <td>0.85 - 1.00</td>
              <td><code className={styles.inlineCode}>ai</code></td>
              <td>Very likely AI-generated</td>
            </tr>
          </tbody>
        </table>

        <div className={styles.dividerThin} />

        {/* Error Codes */}
        <h2 className={styles.sectionTitle}>Error Codes</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>400</td>
              <td>Invalid request body or validation failed</td>
            </tr>
            <tr>
              <td>401</td>
              <td>Missing or invalid API key</td>
            </tr>
            <tr>
              <td>422</td>
              <td>Content extraction failed (URL endpoints)</td>
            </tr>
            <tr>
              <td>429</td>
              <td>Rate limit or monthly quota exceeded</td>
            </tr>
            <tr>
              <td>500</td>
              <td>Internal server error</td>
            </tr>
          </tbody>
        </table>

        <div className={styles.divider} />

        <div className={styles.nav}>
          <Link href="/profile/api-keys" className={styles.navLink}>Manage API Keys</Link>
          <Link href="/profile/usage" className={styles.navLink}>View Usage</Link>
          <Link href="/" className={styles.navLink}>Home</Link>
        </div>
      </div>
    </main>
  )
}
