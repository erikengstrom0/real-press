'use client'

import { useState } from 'react'
import styles from './page.module.css'

interface ImportResult {
  success: boolean
  created: number
  duplicates: number
  errors?: string[]
}

interface TopicResult {
  url: string
  title: string
  snippet: string
}

export default function AdminImportPage() {
  // Bulk import state
  const [urls, setUrls] = useState('')
  const [source, setSource] = useState('manual')
  const [priority, setPriority] = useState(5)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Topic discovery state
  const [topic, setTopic] = useState('')
  const [searching, setSearching] = useState(false)
  const [topicResults, setTopicResults] = useState<TopicResult[]>([])
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())

  const handleBulkImport = async () => {
    const urlList = urls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u && u.startsWith('http'))

    if (urlList.length === 0) {
      alert('No valid URLs found. URLs must start with http:// or https://')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const res = await fetch('/api/admin/crawl/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList, source, priority }),
      })
      const data = await res.json()
      setImportResult(data)
      if (data.success) {
        setUrls('')
      }
    } catch (err) {
      setImportResult({ success: false, created: 0, duplicates: 0, errors: ['Import failed'] })
    } finally {
      setImporting(false)
    }
  }

  const handleTopicSearch = async () => {
    if (!topic.trim()) return

    setSearching(true)
    setTopicResults([])

    try {
      const res = await fetch('/api/admin/crawl/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      })
      const data = await res.json()
      setTopicResults(data.results || [])
      setSelectedUrls(new Set())
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const toggleUrl = (url: string) => {
    const newSelected = new Set(selectedUrls)
    if (newSelected.has(url)) {
      newSelected.delete(url)
    } else {
      newSelected.add(url)
    }
    setSelectedUrls(newSelected)
  }

  const selectAll = () => {
    setSelectedUrls(new Set(topicResults.map(r => r.url)))
  }

  const importSelected = async () => {
    if (selectedUrls.size === 0) return

    setImporting(true)
    try {
      const res = await fetch('/api/admin/crawl/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: Array.from(selectedUrls),
          source: `topic:${topic}`,
          priority: 5,
        }),
      })
      const data = await res.json()
      setImportResult(data)
      if (data.success) {
        setTopicResults([])
        setSelectedUrls(new Set())
        setTopic('')
      }
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      setImporting(false)
    }
  }

  const urlCount = urls.split('\n').filter(u => u.trim() && u.trim().startsWith('http')).length

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>URL Import & Discovery</h1>

      {/* Bulk Import Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Bulk URL Import</h2>
        <p className={styles.description}>Paste URLs (one per line) to add to the crawl queue.</p>

        <textarea
          className={styles.textarea}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder={'https://example.com/article-1\nhttps://example.com/article-2\nhttps://example.com/article-3'}
          rows={10}
        />

        <div className={styles.urlCount}>{urlCount} valid URL{urlCount !== 1 ? 's' : ''} detected</div>

        <div className={styles.options}>
          <label className={styles.label}>
            Source:
            <input
              type="text"
              className={styles.input}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g., manual, rss, etc."
            />
          </label>

          <label className={styles.label}>
            Priority:
            <select
              className={styles.select}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            >
              <option value={10}>High (10)</option>
              <option value={7}>Medium-High (7)</option>
              <option value={5}>Medium (5)</option>
              <option value={3}>Low (3)</option>
              <option value={1}>Lowest (1)</option>
            </select>
          </label>
        </div>

        <button
          className={styles.button}
          onClick={handleBulkImport}
          disabled={importing || urlCount === 0}
        >
          {importing ? 'Importing...' : `Import ${urlCount} URL${urlCount !== 1 ? 's' : ''}`}
        </button>

        {importResult && (
          <div className={importResult.success ? styles.success : styles.error}>
            {importResult.success ? (
              <p>Created {importResult.created} jobs ({importResult.duplicates} duplicates skipped)</p>
            ) : (
              <p>Import failed: {importResult.errors?.join(', ')}</p>
            )}
          </div>
        )}
      </section>

      {/* Topic Discovery Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Topic Discovery</h2>
        <p className={styles.description}>Search for articles on a specific topic to add to the crawl queue.</p>

        <div className={styles.searchRow}>
          <input
            type="text"
            className={styles.searchInput}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTopicSearch()}
            placeholder="e.g., machine learning essays, startup growth, climate science"
          />
          <button
            className={styles.button}
            onClick={handleTopicSearch}
            disabled={searching || !topic.trim()}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {topicResults.length > 0 && (
          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <span>{topicResults.length} results found</span>
              <div className={styles.resultsActions}>
                <button className={styles.linkButton} onClick={selectAll}>
                  Select All
                </button>
                <button
                  className={styles.button}
                  onClick={importSelected}
                  disabled={selectedUrls.size === 0 || importing}
                >
                  Import {selectedUrls.size} Selected
                </button>
              </div>
            </div>

            <ul className={styles.resultsList}>
              {topicResults.map((result) => (
                <li key={result.url} className={styles.resultItem}>
                  <label className={styles.resultLabel}>
                    <input
                      type="checkbox"
                      checked={selectedUrls.has(result.url)}
                      onChange={() => toggleUrl(result.url)}
                    />
                    <div className={styles.resultContent}>
                      <a href={result.url} target="_blank" rel="noopener noreferrer" className={styles.resultTitle}>
                        {result.title}
                      </a>
                      <p className={styles.resultSnippet}>{result.snippet}</p>
                      <span className={styles.resultUrl}>{result.url}</span>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  )
}
