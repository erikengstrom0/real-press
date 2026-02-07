import Link from 'next/link'
import styles from './page.module.css'

export const metadata = {
  title: 'API Documentation \u2014 Real Press',
  description: 'Documentation for the Real Press Verification API. Detect AI-generated content via text, URL, image, or batch endpoints.',
}

export default function DocsPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* ==================== HERO ==================== */}
        <section className={styles.hero}>
          <h1 className={styles.title}>Verification API</h1>
          <p className={styles.subtitle}>
            Detect AI-generated content with a simple REST API. Analyze text,
            URLs, images, or batches of content.
          </p>
          <div className={styles.baseUrl}>
            <span className={styles.baseUrlLabel}>Base URL</span>
            <code className={styles.baseUrlCode}>https://www.real.press/api/v1</code>
          </div>
        </section>

        <div className={styles.divider} />

        {/* ==================== TABLE OF CONTENTS ==================== */}
        <nav className={styles.toc}>
          <h2 className={styles.tocTitle}>Contents</h2>
          <ul className={styles.tocList}>
            <li><a href="#authentication">Authentication</a></li>
            <li><a href="#endpoints">Endpoints</a></li>
            <li><a href="#response-format">Response Format</a></li>
            <li><a href="#rate-limits">Rate Limits</a></li>
            <li><a href="#errors">Error Codes</a></li>
            <li><a href="#examples">Code Examples</a></li>
            <li><a href="#tiers">Tier Comparison</a></li>
          </ul>
        </nav>

        <div className={styles.divider} />

        {/* ==================== AUTHENTICATION ==================== */}
        <section id="authentication" className={styles.section}>
          <h2 className={styles.sectionTitle}>Authentication</h2>
          <p>
            All API requests require authentication via a Bearer token. You can
            generate API keys from your{' '}
            <Link href="/profile/api-keys">API Key Management</Link> page.
          </p>
          <p>
            Include your API key in the <code>Authorization</code> header of
            every request:
          </p>
          <pre className={styles.codeBlock}>
            <code>{`Authorization: Bearer rp_live_your_api_key_here`}</code>
          </pre>
          <div className={styles.note}>
            <span className={styles.noteLabel}>Note</span>
            <p>
              You can also authenticate using your browser session cookie when
              making requests from a logged-in browser session. API keys are
              recommended for programmatic access.
            </p>
          </div>
          <p>
            API keys are prefixed with <code>rp_live_</code> followed by 32
            hexadecimal characters. The raw key is shown only once at creation
            time &mdash; store it securely. You can revoke keys at any time from
            the management page.
          </p>
        </section>

        {/* ==================== ENDPOINTS ==================== */}
        <section id="endpoints" className={styles.section}>
          <h2 className={styles.sectionTitle}>Endpoints</h2>

          {/* ---------- POST /verify/text ---------- */}
          <article className={styles.endpoint}>
            <div className={styles.endpointHeader}>
              <span className={styles.endpointMethod}>POST</span>
              <span className={styles.endpointPath}>/api/v1/verify/text</span>
            </div>
            <p className={styles.endpointDesc}>
              Analyze a plain-text string for AI-generated content. Accepts
              between 50 and 50,000 characters.
            </p>

            <h4 className={styles.subTitle}>Request Body</h4>
            <ul className={styles.paramList}>
              <li>
                <code>text</code> <span className={styles.required}>required</span>
                &mdash; The text content to analyze. Must be between 50 and
                50,000 characters.
              </li>
            </ul>
            <pre className={styles.codeBlock}>
              <code>{`{
  "text": "The quick brown fox jumps over the lazy dog. This is a sample text that needs to be at least fifty characters long for analysis to proceed correctly."
}`}</code>
            </pre>

            <h4 className={styles.subTitle}>Response (Free Tier)</h4>
            <pre className={styles.codeBlock}>
              <code>{`{
  "score": 0.12,
  "classification": "likely_human",
  "confidence": 0.87,
  "analyzedTypes": ["text"]
}`}</code>
            </pre>

            <h4 className={styles.subTitle}>Response (Pro / Enterprise)</h4>
            <pre className={styles.codeBlock}>
              <code>{`{
  "score": 0.12,
  "classification": "likely_human",
  "confidence": 0.87,
  "analyzedTypes": ["text"],
  "breakdown": {
    "providers": [
      {
        "name": "huggingface",
        "model": "roberta-base-openai-detector",
        "score": 0.10,
        "confidence": 0.91,
        "weight": 0.70
      },
      {
        "name": "heuristic",
        "score": 0.15,
        "confidence": 0.75,
        "weight": 0.30
      }
    ],
    "fusion": {
      "method": "weighted_average",
      "weights": { "text": 1.0 }
    },
    "heuristicSignals": {
      "vocabularyDiversity": "high",
      "sentenceVariation": "high",
      "repetitionLevel": "low",
      "punctuationDiversity": "neutral"
    },
    "providerAgreement": "agree"
  }
}`}</code>
            </pre>
          </article>

          {/* ---------- POST /verify/url ---------- */}
          <article className={styles.endpoint}>
            <div className={styles.endpointHeader}>
              <span className={styles.endpointMethod}>POST</span>
              <span className={styles.endpointPath}>/api/v1/verify/url</span>
            </div>
            <p className={styles.endpointDesc}>
              Extract content from a URL and analyze it for AI-generated text.
              Optionally extract and analyze embedded images.
            </p>

            <h4 className={styles.subTitle}>Request Body</h4>
            <ul className={styles.paramList}>
              <li>
                <code>url</code> <span className={styles.required}>required</span>
                &mdash; A valid, publicly accessible URL to analyze.
              </li>
              <li>
                <code>extractMedia</code> <span className={styles.optional}>optional</span>
                &mdash; Set to <code>true</code> to also extract and analyze
                images found on the page. Defaults to <code>false</code>.
              </li>
            </ul>
            <pre className={styles.codeBlock}>
              <code>{`{
  "url": "https://example.com/article",
  "extractMedia": false
}`}</code>
            </pre>

            <h4 className={styles.subTitle}>Response</h4>
            <pre className={styles.codeBlock}>
              <code>{`{
  "score": 0.34,
  "classification": "likely_human",
  "confidence": 0.82,
  "analyzedTypes": ["text"],
  "meta": {
    "title": "Understanding Climate Change",
    "author": "Jane Doe",
    "domain": "example.com",
    "wordCount": 1542,
    "publishedAt": "2026-01-15T10:30:00Z"
  }
}`}</code>
            </pre>

            <div className={styles.note}>
              <span className={styles.noteLabel}>Note</span>
              <p>
                The <code>meta</code> object is included in responses for all
                tiers. Pro and Enterprise tiers also receive the full{' '}
                <code>breakdown</code> object. If content extraction fails (e.g.,
                paywalled or bot-blocked pages), a 422 error is returned.
              </p>
            </div>
          </article>

          {/* ---------- POST /verify/image ---------- */}
          <article className={styles.endpoint}>
            <div className={styles.endpointHeader}>
              <span className={styles.endpointMethod}>POST</span>
              <span className={styles.endpointPath}>/api/v1/verify/image</span>
            </div>
            <p className={styles.endpointDesc}>
              Analyze an image for AI-generated content. Provide either a
              publicly accessible URL or a base64-encoded image.
            </p>

            <h4 className={styles.subTitle}>Request Body</h4>
            <ul className={styles.paramList}>
              <li>
                <code>imageUrl</code> <span className={styles.optional}>one required</span>
                &mdash; A publicly accessible URL to the image file.
              </li>
              <li>
                <code>imageBase64</code> <span className={styles.optional}>one required</span>
                &mdash; A base64-encoded image string (with or without data URI
                prefix).
              </li>
            </ul>
            <pre className={styles.codeBlock}>
              <code>{`// Option A: Image URL
{
  "imageUrl": "https://example.com/photo.jpg"
}

// Option B: Base64 encoded
{
  "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
}`}</code>
            </pre>

            <h4 className={styles.subTitle}>Response</h4>
            <pre className={styles.codeBlock}>
              <code>{`{
  "score": 0.78,
  "classification": "likely_ai",
  "confidence": 0.85,
  "analyzedTypes": ["image"]
}`}</code>
            </pre>
          </article>

          {/* ---------- POST /verify/batch ---------- */}
          <article className={styles.endpoint}>
            <div className={styles.endpointHeader}>
              <span className={styles.endpointMethod}>POST</span>
              <span className={styles.endpointPath}>/api/v1/verify/batch</span>
            </div>
            <p className={styles.endpointDesc}>
              Analyze multiple items in a single request. Supports mixed content
              types (text, URL, image). Each item is processed independently
              &mdash; one failure does not abort the batch.
            </p>

            <h4 className={styles.subTitle}>Request Body</h4>
            <ul className={styles.paramList}>
              <li>
                <code>items</code> <span className={styles.required}>required</span>
                &mdash; An array of items to analyze. Maximum items per request
                depends on your tier: Free = 10, Pro = 25, Enterprise = 50.
              </li>
            </ul>
            <pre className={styles.codeBlock}>
              <code>{`{
  "items": [
    {
      "type": "text",
      "text": "This is a sample paragraph to analyze for AI content..."
    },
    {
      "type": "url",
      "url": "https://example.com/article"
    },
    {
      "type": "image",
      "imageUrl": "https://example.com/photo.jpg"
    }
  ]
}`}</code>
            </pre>

            <h4 className={styles.subTitle}>Response</h4>
            <pre className={styles.codeBlock}>
              <code>{`{
  "results": [
    {
      "score": 0.12,
      "classification": "likely_human",
      "confidence": 0.87,
      "analyzedTypes": ["text"]
    },
    {
      "score": 0.45,
      "classification": "unsure",
      "confidence": 0.62,
      "analyzedTypes": ["text"],
      "meta": {
        "title": "Example Article",
        "author": "John Smith",
        "domain": "example.com",
        "wordCount": 890
      }
    },
    {
      "score": 0.78,
      "classification": "likely_ai",
      "confidence": 0.85,
      "analyzedTypes": ["image"]
    }
  ],
  "summary": {
    "total": 3,
    "succeeded": 3,
    "failed": 0
  }
}`}</code>
            </pre>

            <div className={styles.warning}>
              <span className={styles.warningLabel}>Batch Limits</span>
              <p>
                Free: 10 items per request. Pro: 25 items per request.
                Enterprise: 50 items per request. Exceeding the limit returns a
                400 error.
              </p>
            </div>
          </article>
        </section>

        {/* ==================== RESPONSE FORMAT ==================== */}
        <section id="response-format" className={styles.section}>
          <h2 className={styles.sectionTitle}>Response Format</h2>
          <p>
            All endpoints return a JSON object. The shape of the response
            depends on your account tier.
          </p>

          <h3 className={styles.subTitle}>Free Tier Response</h3>
          <p>
            Free tier responses include the composite score, classification,
            confidence level, and the types of content that were analyzed.
          </p>
          <pre className={styles.codeBlock}>
            <code>{`{
  "score": 0.12,
  "classification": "likely_human",
  "confidence": 0.87,
  "analyzedTypes": ["text"]
}`}</code>
          </pre>

          <h3 className={styles.subTitle}>Pro / Enterprise Response</h3>
          <p>
            Paid tiers receive the full <code>breakdown</code> object in addition
            to the base fields. This includes per-provider scores, fusion
            methodology, heuristic signal analysis, and provider agreement
            status.
          </p>
          <pre className={styles.codeBlock}>
            <code>{`{
  "score": 0.12,
  "classification": "likely_human",
  "confidence": 0.87,
  "analyzedTypes": ["text"],
  "breakdown": {
    "providers": [ ... ],
    "fusion": {
      "method": "weighted_average",
      "weights": { "text": 1.0 }
    },
    "heuristicSignals": {
      "vocabularyDiversity": "high",
      "sentenceVariation": "high",
      "repetitionLevel": "low",
      "punctuationDiversity": "neutral"
    },
    "providerAgreement": "agree"
  }
}`}</code>
          </pre>

          <h3 className={styles.subTitle}>Classification Values</h3>
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
                <td><code>0.00 &ndash; 0.15</code></td>
                <td><code>human</code></td>
                <td>Very likely written by a human</td>
              </tr>
              <tr>
                <td><code>0.15 &ndash; 0.35</code></td>
                <td><code>likely_human</code></td>
                <td>Probably written by a human</td>
              </tr>
              <tr>
                <td><code>0.35 &ndash; 0.65</code></td>
                <td><code>unsure</code></td>
                <td>Cannot determine with confidence</td>
              </tr>
              <tr>
                <td><code>0.65 &ndash; 0.85</code></td>
                <td><code>likely_ai</code></td>
                <td>Probably AI-generated</td>
              </tr>
              <tr>
                <td><code>0.85 &ndash; 1.00</code></td>
                <td><code>ai</code></td>
                <td>Very likely AI-generated</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ==================== RATE LIMITS ==================== */}
        <section id="rate-limits" className={styles.section}>
          <h2 className={styles.sectionTitle}>Rate Limits</h2>
          <p>
            Rate limits are applied per API key on a per-minute sliding window.
            If you exceed the limit, the API returns a <code>429</code> status
            with a <code>Retry-After</code> header.
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Limit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>/verify/text</code></td>
                <td>30 requests / minute</td>
              </tr>
              <tr>
                <td><code>/verify/url</code></td>
                <td>10 requests / minute</td>
              </tr>
              <tr>
                <td><code>/verify/image</code></td>
                <td>10 requests / minute</td>
              </tr>
              <tr>
                <td><code>/verify/batch</code></td>
                <td>5 requests / minute</td>
              </tr>
            </tbody>
          </table>
          <div className={styles.note}>
            <span className={styles.noteLabel}>Note</span>
            <p>
              Rate limits apply equally to all tiers. If you need higher limits,
              please contact us to discuss Enterprise options.
            </p>
          </div>
        </section>

        {/* ==================== ERROR CODES ==================== */}
        <section id="errors" className={styles.section}>
          <h2 className={styles.sectionTitle}>Error Codes</h2>
          <p>
            The API uses standard HTTP status codes. Error responses include a
            JSON body with an <code>error</code> field describing the issue.
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Meaning</th>
                <th>Common Causes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.errorCode}>400</td>
                <td>Bad Request</td>
                <td>Invalid request body, missing required fields, text too short or too long, exceeding batch item limit</td>
              </tr>
              <tr>
                <td className={styles.errorCode}>401</td>
                <td>Unauthorized</td>
                <td>Missing or invalid API key, expired or revoked key</td>
              </tr>
              <tr>
                <td className={styles.errorCode}>422</td>
                <td>Unprocessable Entity</td>
                <td>Content extraction failed (URL endpoint) &mdash; page may be paywalled, bot-blocked, or unavailable</td>
              </tr>
              <tr>
                <td className={styles.errorCode}>429</td>
                <td>Too Many Requests</td>
                <td>Rate limit exceeded. Check the <code>Retry-After</code> header for when to retry</td>
              </tr>
              <tr>
                <td className={styles.errorCode}>500</td>
                <td>Internal Server Error</td>
                <td>An unexpected error occurred on our end. If this persists, please contact support</td>
              </tr>
            </tbody>
          </table>

          <h3 className={styles.subTitle}>Error Response Format</h3>
          <pre className={styles.codeBlock}>
            <code>{`{
  "error": "Text must be between 50 and 50000 characters"
}`}</code>
          </pre>
        </section>

        {/* ==================== CODE EXAMPLES ==================== */}
        <section id="examples" className={styles.section}>
          <h2 className={styles.sectionTitle}>Code Examples</h2>
          <p>
            Below are examples for the <code>/verify/text</code> endpoint.
            The same authentication pattern applies to all endpoints.
          </p>

          <span className={styles.exampleLabel}>curl</span>
          <pre className={styles.codeBlock}>
            <code>{`curl -X POST https://www.real.press/api/v1/verify/text \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer rp_live_your_api_key_here" \\
  -d '{
    "text": "Your content to analyze goes here. It must be at least fifty characters long for the analysis to work properly."
  }'`}</code>
          </pre>

          <span className={styles.exampleLabel}>JavaScript (fetch)</span>
          <pre className={styles.codeBlock}>
            <code>{`const response = await fetch("https://www.real.press/api/v1/verify/text", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer rp_live_your_api_key_here",
  },
  body: JSON.stringify({
    text: "Your content to analyze goes here. It must be at least fifty characters long for the analysis to work properly.",
  }),
});

const result = await response.json();

if (!response.ok) {
  console.error("Error:", result.error);
} else {
  console.log("Score:", result.score);
  console.log("Classification:", result.classification);
  console.log("Confidence:", result.confidence);
}`}</code>
          </pre>

          <span className={styles.exampleLabel}>Python (requests)</span>
          <pre className={styles.codeBlock}>
            <code>{`import requests

response = requests.post(
    "https://www.real.press/api/v1/verify/text",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer rp_live_your_api_key_here",
    },
    json={
        "text": "Your content to analyze goes here. It must be at least fifty characters long for the analysis to work properly."
    },
)

result = response.json()

if response.ok:
    print(f"Score: {result['score']}")
    print(f"Classification: {result['classification']}")
    print(f"Confidence: {result['confidence']}")
else:
    print(f"Error: {result['error']}")`}</code>
          </pre>
        </section>

        {/* ==================== TIER COMPARISON ==================== */}
        <section id="tiers" className={styles.section}>
          <h2 className={styles.sectionTitle}>Tier Comparison</h2>
          <p>
            Real Press offers three tiers. All tiers have access to the same
            endpoints and rate limits. The difference is in the level of detail
            returned in responses and batch sizes.
          </p>
          <table className={styles.tierTable}>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free</th>
                <th>Pro</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Composite Score</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>Classification</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>Confidence Level</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>URL Metadata</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>Provider Breakdown</td>
                <td className={styles.cross}>&mdash;</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>Heuristic Signals</td>
                <td className={styles.cross}>&mdash;</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>Fusion Details</td>
                <td className={styles.cross}>&mdash;</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>Provider Agreement</td>
                <td className={styles.cross}>&mdash;</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>Batch Items (max)</td>
                <td>10</td>
                <td>25</td>
                <td>50</td>
              </tr>
              <tr>
                <td>Text Verification</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>URL Verification</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>Image Verification</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
              <tr>
                <td>Batch Verification</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
                <td className={styles.check}>Yes</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </main>
  )
}
