'use client'

import { AIScoreBadge } from '@/components/AIScoreBadge'
import type { Classification } from '@/lib/ai-detection'

const classifications: { classification: Classification; score: number }[] = [
  { classification: 'human', score: 0.05 },
  { classification: 'likely_human', score: 0.25 },
  { classification: 'unsure', score: 0.5 },
  { classification: 'likely_ai', score: 0.75 },
  { classification: 'ai', score: 0.95 },
]

export default function DemoPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 className="masthead-title" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        Real Press Style Guide
      </h1>

      {/* Color Palette */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="h3">Color Palette</h2>
        <div className="rule-double" />

        <h3 className="h5" style={{ marginTop: '1.5rem' }}>Primary Colors</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <ColorSwatch name="Accent Primary" hex="#249445" />
          <ColorSwatch name="Accent Secondary" hex="#9CE7B3" />
          <ColorSwatch name="Accent Gold" hex="#F3D653" />
          <ColorSwatch name="Light Sky" hex="#C9E0F8" />
          <ColorSwatch name="Light Ghost" hex="#F7F3F7" />
        </div>

        <h3 className="h5" style={{ marginTop: '2rem' }}>Neutral Colors</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <ColorSwatch name="White" hex="#FFFFFF" />
          <ColorSwatch name="Cream" hex="#FAF8F5" />
          <ColorSwatch name="Paper" hex="#F5F2ED" />
          <ColorSwatch name="Paper Dark" hex="#EBE7E0" />
          <ColorSwatch name="Charcoal" hex="#2D2A26" dark />
          <ColorSwatch name="Ink" hex="#1A1816" dark />
        </div>

        <h3 className="h5" style={{ marginTop: '2rem' }}>AI Score Spectrum</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <ColorSwatch name="Human" hex="#249445" />
          <ColorSwatch name="Likely Human" hex="#6BBF7B" />
          <ColorSwatch name="Unsure" hex="#8B8680" />
          <ColorSwatch name="Likely AI" hex="#C4835A" />
          <ColorSwatch name="AI" hex="#A65D5D" />
        </div>
      </section>

      {/* AI Score Stamps */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="h3">AI Score Stamps</h2>
        <div className="rule-double" />

        <h3 className="h5" style={{ marginTop: '1.5rem' }}>All Classifications</h3>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
          {classifications.map(({ classification, score }) => (
            <div key={classification} style={{ textAlign: 'center' }}>
              <AIScoreBadge
                score={score}
                classification={classification}
                showScore
                size="large"
              />
              <p className="caption" style={{ marginTop: '0.5rem' }}>
                {Math.round((1 - score) * 100)}% Human
              </p>
            </div>
          ))}
        </div>

        <h3 className="h5" style={{ marginTop: '2rem' }}>Stamp Sizes</h3>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <AIScoreBadge score={0.1} classification="human" size="small" />
            <p className="caption" style={{ marginTop: '0.5rem' }}>Small</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <AIScoreBadge score={0.1} classification="human" size="medium" />
            <p className="caption" style={{ marginTop: '0.5rem' }}>Medium</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <AIScoreBadge score={0.1} classification="human" size="large" />
            <p className="caption" style={{ marginTop: '0.5rem' }}>Large</p>
          </div>
        </div>

        <h3 className="h5" style={{ marginTop: '2rem' }}>Random Variations (Refresh to see changes)</h3>
        <p className="small text-muted" style={{ marginBottom: '1rem' }}>
          Each stamp has random rotation, opacity, and pressure for an authentic rubber stamp feel.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {[...Array(8)].map((_, i) => (
            <AIScoreBadge key={i} score={0.1} classification="human" showScore size="medium" />
          ))}
        </div>
      </section>

      {/* Typography */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="h3">Typography</h2>
        <div className="rule-double" />

        <div style={{ marginTop: '1.5rem' }}>
          <h1 className="h1">Headline 1 - Caudex Bold</h1>
          <h2 className="h2">Headline 2 - Caudex Bold</h2>
          <h3 className="h3">Headline 3 - Caudex Bold</h3>
          <h4 className="h4">Headline 4 - Caudex Bold</h4>
          <h5 className="h5">Headline 5 - Caudex Bold</h5>
          <h6 className="h6">Headline 6 - Caudex Bold</h6>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <p className="lead">
            This is lead paragraph text. It&apos;s slightly larger and used for introductions.
          </p>
          <p>
            This is regular body text using Lato font. It&apos;s optimized for readability
            in longer passages of content.
          </p>
          <p className="small text-muted">
            This is small muted text, often used for captions and metadata.
          </p>
          <p className="caption">THIS IS CAPTION TEXT - UPPERCASE WITH WIDE TRACKING</p>
        </div>
      </section>

      {/* Buttons */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="h3">Buttons</h2>
        <div className="rule-double" />

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem', alignItems: 'center' }}>
          <button className="btn">Default Button</button>
          <button className="btn btn-primary">Primary Button</button>
          <button className="btn btn-gold">Gold Button</button>
          <button className="btn btn-ghost">Ghost Button</button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem', alignItems: 'center' }}>
          <button className="btn btn-sm">Small</button>
          <button className="btn">Medium</button>
          <button className="btn btn-lg">Large</button>
        </div>
      </section>

      {/* Rules & Dividers */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="h3">Rules & Dividers</h2>
        <div className="rule-double" />

        <p style={{ marginTop: '1.5rem' }}>Standard rule:</p>
        <hr className="rule" />

        <p>Thick rule:</p>
        <hr className="rule rule-thick" />

        <p>Double rule:</p>
        <div className="rule-double" />

        <p style={{ marginTop: '2rem' }}>Ornate rule:</p>
        <div className="rule-ornate" />
      </section>

      {/* Cards */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="h3">Cards</h2>
        <div className="rule-double" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
          <div className="card">
            <h3 className="card-headline">Card Title</h3>
            <p className="card-body">
              This is card body text. Cards have a subtle hover effect that lifts and rotates slightly.
            </p>
          </div>
          <div className="card">
            <h3 className="card-headline">Another Card</h3>
            <p className="card-body">
              Hover over this card to see the paper lift effect that mimics picking up a newspaper clipping.
            </p>
          </div>
          <div className="card">
            <h3 className="card-headline">Third Card</h3>
            <p className="card-body">
              Cards use cream background with charcoal borders for a classic newspaper feel.
            </p>
          </div>
        </div>
      </section>

      {/* Sample Search Results */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 className="h3">Sample Search Results</h2>
        <div className="rule-double" />

        <div style={{ marginTop: '1.5rem' }}>
          {classifications.map(({ classification, score }, i) => (
            <div key={classification} className="result-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                  <a href="#" className="result-title">
                    Sample Article About {classification.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Content
                  </a>
                  <p className="byline">
                    <span className="byline-source">example.com</span>
                    <span className="byline-separator">|</span>
                    <span className="byline-date">January 29, 2026</span>
                  </p>
                  <p className="result-description">
                    This is a sample description showing how search results would appear with this classification level.
                    The stamp indicates the AI detection score.
                  </p>
                </div>
                <AIScoreBadge score={score} classification={classification} showScore size="medium" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '2rem 0', borderTop: '1px solid var(--color-charcoal-muted)' }}>
        <p className="text-muted">Real Press Style Guide</p>
      </footer>
    </main>
  )
}

function ColorSwatch({ name, hex, dark = false }: { name: string; hex: string; dark?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: '80px',
          height: '80px',
          backgroundColor: hex,
          border: '1px solid #6B665E',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '0.25rem',
        }}
      >
        <span style={{ fontSize: '0.65rem', color: dark ? '#fff' : '#333' }}>{hex}</span>
      </div>
      <p className="caption" style={{ marginTop: '0.5rem', fontSize: '0.65rem' }}>{name}</p>
    </div>
  )
}
