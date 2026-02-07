# ⛔ ARCHIVED — DO NOT USE FOR PLANNING

> **This file is archived. Phase 7 (Wave 1 and Wave 2) is fully complete.**
> All tasks in this file have been implemented, even though some checkboxes remain unchecked. The decisions log in `CLAUDE.md` documents what was actually built.
>
> **Source of truth:** [`CLAUDE.md`](./CLAUDE.md) — contains the current architecture, sprint status, decisions log, and future TODOs.
> If you are a Claude instance or agent, **do not execute tasks from this file**. Read `CLAUDE.md` instead.
>
> *Archived: 2026-02-07*

---

# Phase 7: Explainability & Analytics (Detection Breakdown as a Product) (ARCHIVED)

> **Goal:** Store the full detection breakdown (per-provider scores, heuristic sub-features, per-image/per-frame results) and expose it as a paid feature for both consumer users and API customers.
>
> **Depends on:** Phase 2 (Billing), Phase 4 (Authenticity API)
> **Enhances:** Phase 1 (Premium Search), Phase 4 (API), Phase 6 (Publisher Dashboards)
> **Supports search by:** Differentiated paid tier drives revenue; detailed signals enable weight tuning for better detection accuracy

---

## Overview

Today the detection pipeline computes rich per-provider scores, heuristic sub-features, per-image results, and per-frame video timelines — then throws them away, storing only the final blended numbers. This phase persists all of that data and surfaces it as the "why" behind every score.

**Free users** see the verdict: "Verified Authentic" or "Likely AI."
**Paid users** see the evidence: which providers agreed/disagreed, which stylometric features triggered, which images passed/failed, and how the score was built.

This is a genuine competitive differentiator. GPTZero, Originality.ai, and others return a single number. Real Press would be the first to offer multi-modal explainability — showing not just *what* the score is, but *why*.

---

## What's Currently Lost

Data computed by the pipeline but not persisted:

| Data | Source | Why It Matters |
|------|--------|----------------|
| Per-provider text scores | HuggingFace, GPTZero, Heuristics individually | Can't show provider agreement/disagreement |
| Primary provider identity | Which provider was primary for this analysis | Can't explain which model drove the score |
| Heuristic sub-features | `vocabularyDiversity`, `sentenceLengthVariation`, `avgSentenceLength`, `punctuationVariety` | Can't show *why* heuristics flagged content |
| Heuristic word/paragraph counts | `wordCount`, `paragraphCount` from heuristic analysis | Can't show analysis depth |
| Provider availability flags | Which providers were online when analysis ran | Can't distinguish "provider unavailable" from "provider returned 0" |
| Per-image scores | Individual CNN scores before aggregation | Can't show which specific images triggered |
| Per-frame video scores | Each frame's score before averaging + variance penalty | Can't show timeline of AI probability through a video |
| GPTZero per-paragraph scores | `paragraphs[].completely_generated_prob` | Can't highlight which paragraphs look AI-generated |
| GPTZero burstiness | Sentence-level variation metric from GPTZero | Lost diagnostic signal |
| Fusion weights used | The actual effective weights after confidence adjustment | Can't show how much each modality contributed |
| `MediaScore` records | Per-image/per-video individual results | `media_scores` table exists but is never written to |

---

## Layer 1: Storage

### 1.1 Schema Migration — `AiScore` Table Changes

Add three JSONB columns to the existing `AiScore` model:

```prisma
model AiScore {
  // ... existing fields unchanged ...

  // NEW: Explainability data (JSONB)
  providerDetails    Json?    @map("provider_details")
  heuristicMetrics   Json?    @map("heuristic_metrics")
  fusionDetails      Json?    @map("fusion_details")
}
```

**`providerDetails`** — Array of per-provider results:
```typescript
interface StoredProviderDetail {
  name: string              // 'huggingface' | 'gptzero' | 'heuristic'
  type: string              // 'text' | 'image' | 'video'
  score: number             // Raw provider score (0-1)
  confidence: number        // Provider's own confidence (0-1)
  isPrimary: boolean        // Was this the primary provider for its type?
  available: boolean        // Was this provider available?
  metadata?: {
    // HuggingFace-specific
    model?: string
    truncated?: boolean
    // GPTZero-specific
    burstiness?: number
    averageGeneratedProb?: number
    completelyGeneratedProb?: number
    paragraphScores?: Array<{ index: number; score: number }>
    // Image-specific
    imageUrl?: string
    imageIndex?: number
    // Video-specific
    frameIndex?: number
    frameTimestamp?: number
  }
}
```

**`heuristicMetrics`** — The 6 stylometric features:
```typescript
interface StoredHeuristicMetrics {
  vocabularyDiversity: number       // Type-token ratio (0-1)
  sentenceLengthVariation: number   // Coefficient of variation
  avgSentenceLength: number         // Words per sentence
  punctuationVariety: number        // Unique punctuation ratio (0-1)
  paragraphCount: number
  wordCount: number
  // Sub-scores (what each feature contributed)
  featureScores: {
    vocabularyScore: number         // 0-1 (higher = more AI-like)
    variationScore: number
    punctuationScore: number
    lengthScore: number
  }
  featureWeights: {
    vocabulary: number              // 0.35
    variation: number               // 0.30
    punctuation: number             // 0.15
    length: number                  // 0.20
  }
}
```

**`fusionDetails`** — How the final score was assembled:
```typescript
interface StoredFusionDetails {
  method: 'text_only' | 'multi_modal'
  // Text fusion
  textFusion?: {
    primaryProvider: string
    apiWeight: number               // Effective weight used
    heuristicWeight: number         // Effective weight used
    apiScore: number
    heuristicScore: number
  }
  // Multi-modal fusion
  modalityWeights?: Array<{
    type: string                    // 'text' | 'image' | 'video'
    baseWeight: number              // 0.50, 0.35, 0.15
    confidence: number              // Provider confidence
    effectiveWeight: number         // baseWeight × confidence
    score: number                   // Score going into fusion
    contribution: number            // effectiveWeight / totalWeight (percentage of final score)
  }>
  totalEffectiveWeight: number
}
```

#### Tasks:

- [ ] **1.1.1** Add `providerDetails`, `heuristicMetrics`, `fusionDetails` JSONB columns to `AiScore` in `prisma/schema.prisma`
- [ ] **1.1.2** Run `npx prisma db push` to sync schema to Neon
- [ ] **1.1.3** Run `npx prisma generate` to update the Prisma client

### 1.2 Wire Up `MediaScore` Table

The `media_scores` table already exists in the schema but is never written to. Wire it up.

#### Tasks:

- [ ] **1.2.1** In `analyzeMultiModalAndStore()` (`ai-detection.service.ts`): after creating `ContentMedia` records for images, query for the created media IDs
- [ ] **1.2.2** Store individual image detection results in `MediaScore` — one row per image, with `score`, `confidence`, and `providerName` from the per-image CNN result
- [ ] **1.2.3** Store video detection result in `MediaScore` — one row for the video, with the aggregated frame score
- [ ] **1.2.4** Add a `frameScores` JSONB column to `MediaScore` to store per-frame breakdown for video:
  ```prisma
  model MediaScore {
    // ... existing fields ...
    frameScores    Json?    @map("frame_scores")  // NEW
  }
  ```
  Shape: `Array<{ index: number; timestamp: number; score: number; confidence: number }>`

### 1.3 Pipe Provider Data Through the Detection Pipeline

Currently the detection pipeline returns `ContentTypeScore[]` with a `metadata` bag, but the heuristic sub-features and per-provider breakdown don't survive to the service layer. Thread them through.

#### Tasks:

- [x] **1.3.1** Update `HeuristicProvider` (`heuristic.provider.ts`): include the 4 feature sub-scores (`vocabScore`, `variationScore`, `punctuationScore`, `lengthScore`) and their weights in the `metadata` field of the `ProviderResult`
- [x] **1.3.2** Update `HuggingFaceProvider` (`huggingface.provider.ts`): include `model`, `truncated` flag, and raw classification labels in `metadata`
- [x] **1.3.3** Update `GPTZeroProvider` (`gptzero.provider.ts`): include `burstiness`, `averageGeneratedProb`, and per-paragraph scores in `metadata`
- [x] **1.3.4** Update `detectAIContent()` in `index.ts`: return provider availability flags and which provider was primary in the `CompositeResult.metadata`
- [x] **1.3.5** Update `detectMultiModalContent()` in `index.ts`: return the full `contentScores[]` array (it already does — verify it includes all provider metadata)
- [x] **1.3.6** Update `calculateCompositeScore()` in `composite-score.ts`: return the effective weights used in fusion as part of the result
- [x] **1.3.7** Update `calculateMultiModalComposite()` in `composite-score.ts`: return per-modality effective weights and contribution percentages
- [x] **1.3.8** Update `ImageProvider` (`image-local.provider.ts`): return per-image scores (not just the aggregated result) in metadata
- [x] **1.3.9** Update `VideoProvider` (`video.provider.ts`): return per-frame scores array in metadata

### 1.4 Persist Full Breakdown in Service Layer

Update the service functions to write the new JSONB columns.

#### Tasks:

- [ ] **1.4.1** Update `analyzeAndStoreScore()` in `ai-detection.service.ts`:
  - Build `providerDetails` array from HuggingFace/GPTZero/Heuristic results
  - Build `heuristicMetrics` from the heuristic provider's metadata
  - Build `fusionDetails` from the composite score calculation
  - Pass all three to `prisma.aiScore.create()`
- [ ] **1.4.2** Update `analyzeMultiModalAndStore()` in `ai-detection.service.ts`:
  - Build `providerDetails` from `result.contentScores[]` metadata
  - Build `heuristicMetrics` from text provider's heuristic sub-results
  - Build `fusionDetails` with multi-modal weight breakdown
  - Write `MediaScore` records for each image and video
  - Pass all three JSONB fields to `prisma.aiScore.create()`
- [ ] **1.4.3** Update `MultiModalAnalyzeResult` interface to include the new fields in the return type
- [ ] **1.4.4** Update `AnalyzeContentResult` interface to include the new fields in the return type

### 1.5 Backfill Strategy

Existing content won't have explainability data. Plan for this.

#### Tasks:

- [ ] **1.5.1** Add an admin endpoint `POST /api/admin/backfill-explainability` that re-runs detection on content missing `providerDetails` and updates the JSONB columns without changing the composite score (store the new breakdown alongside the original score)
- [ ] **1.5.2** Add a `hasExplainability` virtual/computed check: `providerDetails IS NOT NULL` — used by the UI to show "detailed breakdown available" vs "analyzed before explainability was added"
- [ ] **1.5.3** Backfill script should be batchable (process N at a time) and idempotent (skip already-filled rows)

---

## Layer 2: API Tier Gating

### 2.1 Define Response Tiers

Tier gating happens at the API response level — the detection pipeline always computes everything, but the response is stripped based on the caller's plan.

**Free response:**
```json
{
  "score": 0.15,
  "classification": "verified_authentic",
  "confidence": 0.87,
  "analyzedTypes": ["text", "image"]
}
```

**Paid response** (same request, Pro/Enterprise tier):
```json
{
  "score": 0.15,
  "classification": "verified_authentic",
  "confidence": 0.87,
  "analyzedTypes": ["text", "image"],
  "breakdown": {
    "providers": [
      {
        "name": "huggingface",
        "type": "text",
        "score": 0.12,
        "confidence": 0.91,
        "isPrimary": true
      },
      {
        "name": "heuristic",
        "type": "text",
        "score": 0.18,
        "confidence": 0.72,
        "isPrimary": false,
        "metrics": {
          "vocabularyDiversity": { "value": 0.68, "signal": "high", "humanRange": "0.4-0.7" },
          "sentenceVariation": { "value": 0.55, "signal": "high", "humanRange": "0.3-0.6" },
          "avgSentenceLength": { "value": 17.2, "signal": "neutral", "humanRange": "varies" },
          "punctuationVariety": { "value": 0.75, "signal": "high", "humanRange": "0.5-1.0" }
        }
      }
    ],
    "images": [
      { "index": 0, "url": "...", "score": 0.20, "confidence": 0.82 },
      { "index": 1, "url": "...", "score": 0.08, "confidence": 0.90 }
    ],
    "fusion": {
      "method": "multi_modal",
      "weights": [
        { "type": "text", "baseWeight": 0.50, "effectiveWeight": 0.455, "contribution": "62%" },
        { "type": "image", "baseWeight": 0.35, "effectiveWeight": 0.280, "contribution": "38%" }
      ]
    },
    "providerAgreement": "agree"
  }
}
```

#### Tasks:

- [ ] **2.1.1** Define `ExplainabilityBreakdown` TypeScript interface matching the paid response shape above
- [ ] **2.1.2** Define `BreakdownSignal` type: `'low' | 'neutral' | 'high'` with human-readable ranges for each heuristic metric
- [ ] **2.1.3** Define `ProviderAgreement` type: `'agree' | 'mixed' | 'disagree'` — computed from provider score variance

### 2.2 Response Formatter

Build a function that takes the full stored data and formats it for the appropriate tier.

#### Tasks:

- [ ] **2.2.1** Create `src/lib/ai-detection/format-breakdown.ts`:
  - `formatFreeResponse(aiScore)` — strips everything except score, classification, confidence, analyzedTypes
  - `formatPaidResponse(aiScore, mediaScores?)` — includes full breakdown with provider details, heuristic metrics as signals, image/frame breakdown, fusion weights, and provider agreement
- [ ] **2.2.2** Implement `computeProviderAgreement(providerDetails[])`:
  - All providers within 0.15 of each other → `'agree'`
  - Max spread > 0.30 → `'disagree'`
  - Otherwise → `'mixed'`
- [ ] **2.2.3** Implement `metricToSignal(metricName, value)`:
  - Maps raw heuristic values to `'low' | 'neutral' | 'high'` using human-baseline ranges
  - Includes the human-expected range string (e.g., `"0.4-0.7"`) for context
  - Does NOT expose raw thresholds or scoring formulas (protects against gaming)
- [ ] **2.2.4** Implement `formatImageBreakdown(mediaScores[])`:
  - Returns per-image scores with index and URL
  - For video: returns frame timeline array
- [ ] **2.2.5** Implement `formatFusionDetails(fusionDetails)`:
  - Returns per-modality base weight, effective weight, and contribution percentage
  - Expresses contribution as percentage string for readability

### 2.3 Integrate with API Endpoints

Wire the formatter into the Phase 4 API endpoints.

#### Tasks:

- [ ] **2.3.1** Update `POST /api/v1/verify/text` (Phase 4): check caller tier, call `formatFreeResponse` or `formatPaidResponse` accordingly
- [ ] **2.3.2** Update `POST /api/v1/verify/url` (Phase 4): same tier check + include image/video breakdown for paid users
- [ ] **2.3.3** Update `POST /api/v1/verify/image` (Phase 4): include CNN confidence details for paid users
- [ ] **2.3.4** Update `POST /api/v1/verify/batch` (Phase 4): apply tier formatting to each item in the batch
- [ ] **2.3.5** Add `detailed` query parameter: paid users can opt out of the full breakdown with `?detailed=false` to reduce payload size
- [ ] **2.3.6** Add `X-Breakdown-Available: true/false` response header so free users know they're missing data

### 2.4 Tier Check Middleware

#### Tasks:

- [ ] **2.4.1** Create `src/lib/api/check-tier.ts`: utility that takes an API key and returns the user's tier (`'free' | 'pro' | 'enterprise'`)
- [ ] **2.4.2** Extend the Phase 4 API key validation middleware to attach `req.tier` to the request context
- [ ] **2.4.3** Ensure the tier check doesn't add latency — cache user tier alongside the API key validation cache (already planned in Phase 4)

### 2.5 Consumer (Non-API) Tier Gating

For logged-in users on real.press viewing content pages (not API).

#### Tasks:

- [ ] **2.5.1** Update the content detail page to fetch explainability data from the DB when the user is Pro
- [ ] **2.5.2** Add a "See why" teaser for free users — show that the breakdown exists, with a blurred/locked preview and upgrade CTA
- [ ] **2.5.3** Create `GET /api/content/[id]/breakdown` endpoint: returns the formatted breakdown, gated by user session tier

---

## Layer 3: Consumer UI — Explainability Dashboard

### 3.1 Content Detail Page — Breakdown Section

Add a new section below the existing score badge on the content detail/search result expanded view.

#### Tasks:

- [ ] **3.1.1** Create `src/components/explainability/BreakdownPanel.tsx` — container component that receives the breakdown data and renders sub-components
- [ ] **3.1.2** Create `src/components/explainability/BreakdownPanel.module.css` — retro newspaper styling matching the existing design system
- [ ] **3.1.3** Wire `BreakdownPanel` into the content detail page, conditional on user tier

### 3.2 Provider Agreement Indicator

Show whether the detection providers agreed or disagreed.

#### Tasks:

- [ ] **3.2.1** Create `src/components/explainability/ProviderAgreement.tsx`:
  - "Providers Agree" (green) / "Providers Mixed" (yellow) / "Providers Disagree" (orange)
  - Shows list of providers used with their individual scores
  - Stamp-styled badge matching existing design language
- [ ] **3.2.2** Create `src/components/explainability/ProviderAgreement.module.css`

### 3.3 Heuristic Radar Chart

Show the 4 stylometric features as a radar/spider chart.

#### Tasks:

- [ ] **3.3.1** Create `src/components/explainability/HeuristicRadar.tsx`:
  - 4 axes: Vocabulary Diversity, Sentence Rhythm, Punctuation Variety, Sentence Length
  - Overlay "human baseline" range as a shaded region
  - Current article's values plotted as a polygon
  - Pure CSS/SVG implementation (no chart library dependency)
- [ ] **3.3.2** Create `src/components/explainability/HeuristicRadar.module.css`
- [ ] **3.3.3** Each axis shows a signal indicator: "Typical of human writing" / "Unusual pattern" / "Typical of AI"
- [ ] **3.3.4** Tooltip on hover explains what each metric means in plain English

### 3.4 Modality Weight Breakdown

Show how each content type contributed to the final score.

#### Tasks:

- [ ] **3.4.1** Create `src/components/explainability/ModalityBreakdown.tsx`:
  - Horizontal stacked bar showing text/image/video contribution percentages
  - Each segment labeled with the modality score and effective weight
  - Color-coded: green (human-leaning) through red (AI-leaning) per segment
- [ ] **3.4.2** Create `src/components/explainability/ModalityBreakdown.module.css`
- [ ] **3.4.3** If only text was analyzed, show a simplified single-bar view

### 3.5 Per-Image Grid

Show individual image detection results.

#### Tasks:

- [ ] **3.5.1** Create `src/components/explainability/ImageGrid.tsx`:
  - Thumbnail grid of analyzed images
  - Each thumbnail shows a small score badge (CNN score)
  - Green border for passing images, red border for flagged
  - Click to expand with full score details
- [ ] **3.5.2** Create `src/components/explainability/ImageGrid.module.css`

### 3.6 Video Frame Timeline

Show AI probability over time for video content.

#### Tasks:

- [ ] **3.6.1** Create `src/components/explainability/FrameTimeline.tsx`:
  - Horizontal timeline chart (SVG) showing AI probability at each sampled frame
  - X-axis: timestamp, Y-axis: AI probability (0-1)
  - Color gradient fill: green (low) to red (high)
  - Dashed line at the classification thresholds (0.35, 0.65)
  - Shows the variance penalty and its effect on final confidence
- [ ] **3.6.2** Create `src/components/explainability/FrameTimeline.module.css`

### 3.7 Paragraph-Level Highlighting (GPTZero only)

If GPTZero per-paragraph data is available, highlight the article text.

#### Tasks:

- [ ] **3.7.1** Create `src/components/explainability/ParagraphHighlighter.tsx`:
  - Renders the article text with per-paragraph background color
  - Green (human-leaning) → Red (AI-leaning) per paragraph
  - Subtle, not overwhelming — light tints, not full saturation
  - Hover shows the paragraph's individual score
- [ ] **3.7.2** Create `src/components/explainability/ParagraphHighlighter.module.css`
- [ ] **3.7.3** Only render when GPTZero data is present in `providerDetails`; otherwise show a note that paragraph-level analysis requires GPTZero

### 3.8 Free User Teaser / Upgrade CTA

#### Tasks:

- [ ] **3.8.1** Create `src/components/explainability/BreakdownTeaser.tsx`:
  - Shows a blurred/dimmed preview of the breakdown panel
  - "Unlock the full analysis" CTA with link to upgrade
  - Brief bullet list of what's included: "Provider agreement, writing style analysis, per-image scores, fusion weight breakdown"
- [ ] **3.8.2** Create `src/components/explainability/BreakdownTeaser.module.css`
  - CSS `filter: blur(3px)` on the preview content
  - Overlay with upgrade button

### 3.9 "Why This Score?" Summary

Auto-generated plain-English explanation of the score.

#### Tasks:

- [ ] **3.9.1** Create `src/lib/ai-detection/explain-score.ts`:
  - `generateExplanation(breakdown: ExplainabilityBreakdown): string`
  - Produces 2-3 sentences explaining the score
  - Examples:
    - "This article scored as Verified Authentic. All three detection providers agreed. The writing shows high vocabulary diversity and varied sentence structure, both typical of human authorship."
    - "This article scored as Likely AI. The text detection flagged uniform sentence lengths and low vocabulary diversity. The two analyzed images scored differently — one appeared authentic while the other was flagged."
- [ ] **3.9.2** Wire the explanation into `BreakdownPanel` as the first element — a human-readable summary before the detailed charts

---

## Anti-Gaming Considerations

Exposing the algorithm helps adversaries tune their AI output. Mitigations:

| Risk | Mitigation |
|------|-----------|
| Raw heuristic thresholds exposed | Show signals (`low`/`neutral`/`high`) not raw numbers or scoring formulas |
| Exact provider weights visible | Show contribution percentages, not the base weights or confidence formulas |
| Per-paragraph scores enable targeted editing | Only available when GPTZero is the provider (paid tier); most users won't have this |
| Feature weights exposed | Do NOT expose the 0.35/0.30/0.15/0.20 heuristic weights in the API — show feature names and signal levels only |
| Classification thresholds reverse-engineered | Already public in the codebase; not a meaningful secret |

---

## Parallel Implementation Plan

The 56 tasks are grouped into 5 agents across 2 waves. **Wave 1 agents have zero file conflicts** and run simultaneously. Wave 2 is a single integration agent that merges everything.

### Dependency Graph

```
Wave 1 (parallel — no file conflicts):
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Agent A          │ │  Agent B          │ │  Agent C          │ │  Agent D          │
│  PIPELINE         │ │  SCHEMA           │ │  FORMATTERS       │ │  UI COMPONENTS    │
│                  │ │                  │ │                  │ │                  │
│  Providers +     │ │  Prisma migration │ │  Response format  │ │  All React        │
│  types +         │ │  + db push +      │ │  + explain-score  │ │  components +     │
│  composite-score │ │  generate         │ │  + check-tier     │ │  CSS modules      │
│  + orchestrator  │ │                  │ │                  │ │                  │
│  9 tasks         │ │  4 tasks          │ │  9 tasks          │ │  20 tasks         │
└────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                    │                    │
         └────────────────────┼────────────────────┼────────────────────┘
                              │                    │
                              ▼                    │
Wave 2 (after all Wave 1 agents merge):           │
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Agent E: INTEGRATION                                                           │
│                                                                                 │
│  Service layer persistence + MediaScore wiring + API endpoint integration +     │
│  backfill endpoint + consumer tier gating + wire UI into pages                  │
│  14 tasks                                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### File Ownership (Zero Conflicts in Wave 1)

| Agent | Files Modified | Files Created |
|-------|---------------|---------------|
| **A: Pipeline** | `types.ts`, `composite-score.ts`, `index.ts`, all 5 `providers/*.ts` | — |
| **B: Schema** | `prisma/schema.prisma` | — |
| **C: Formatters** | — | `format-breakdown.ts`, `explain-score.ts`, `check-tier.ts` |
| **D: UI** | — | All 8 component `.tsx` + `.module.css` files in `components/explainability/` |
| **E: Integration** | `ai-detection.service.ts` | `api/content/[id]/breakdown/route.ts`, `api/admin/backfill-explainability/route.ts` |

---

### Agent A: Pipeline Enhancement

**Scope:** Thread rich metadata through the detection pipeline so every provider's full output is available at the service layer.

**Tasks:**
- [x] 1.3.1 — `heuristic.provider.ts`: include 4 feature sub-scores + weights in metadata
- [x] 1.3.2 — `huggingface.provider.ts`: include model, truncated flag, classification labels in metadata
- [x] 1.3.3 — `gptzero.provider.ts`: include burstiness, averageGeneratedProb, per-paragraph scores in metadata
- [x] 1.3.4 — `index.ts` (`detectAIContent`): return provider availability flags + primary provider in metadata
- [x] 1.3.5 — `index.ts` (`detectMultiModalContent`): verify contentScores[] includes all provider metadata
- [x] 1.3.6 — `composite-score.ts` (`calculateCompositeScore`): return effective weights used in fusion
- [x] 1.3.7 — `composite-score.ts` (`calculateMultiModalComposite`): return per-modality effective weights + contribution percentages
- [x] 1.3.8 — `image-local.provider.ts`: return per-image scores (not just aggregated) in metadata
- [x] 1.3.9 — `video.provider.ts`: return per-frame scores array in metadata

**Verification:** Call `detectMultiModalContent()` with text + images, confirm the returned `contentScores[].metadata` includes heuristic sub-scores, provider model info, and per-image individual scores.

**Branch:** `phase7/agent-a-pipeline` — **PR #14** ✅

---

### Agent B: Schema Migration

**Scope:** Add JSONB columns to the database and regenerate the Prisma client.

**Tasks:**
- [ ] 1.1.1 — Add `providerDetails`, `heuristicMetrics`, `fusionDetails` JSONB columns to `AiScore`
- [ ] 1.2.4 — Add `frameScores` JSONB column to `MediaScore`
- [ ] 1.1.2 — Run `npx prisma db push` to sync schema to Neon
- [ ] 1.1.3 — Run `npx prisma generate` to update the Prisma client

**Verification:** Run `npx prisma studio`, confirm the new columns appear on `ai_scores` and `media_scores` tables.

**Branch:** `phase7/agent-b-schema`

---

### Agent C: Response Formatting & Tier Logic

**Scope:** Build the utilities that transform raw stored data into free/paid API responses, plus the plain-English explanation generator and tier check utility.

**Tasks:**
- [ ] 2.1.1 — Define `ExplainabilityBreakdown` TypeScript interface
- [ ] 2.1.2 — Define `BreakdownSignal` type with human-readable ranges
- [ ] 2.1.3 — Define `ProviderAgreement` type
- [ ] 2.2.1 — Create `format-breakdown.ts` with `formatFreeResponse()` and `formatPaidResponse()`
- [ ] 2.2.2 — Implement `computeProviderAgreement()`
- [ ] 2.2.3 — Implement `metricToSignal()` (maps values to low/neutral/high without exposing thresholds)
- [ ] 2.2.4 — Implement `formatImageBreakdown()` for per-image + frame timeline formatting
- [ ] 2.2.5 — Implement `formatFusionDetails()` with contribution percentages
- [ ] 2.4.1 — Create `check-tier.ts` utility
- [ ] 3.9.1 — Create `explain-score.ts` with `generateExplanation()` function

**Verification:** Unit test the formatters with sample JSONB data; confirm free response strips breakdown, paid response includes it with signals instead of raw thresholds.

**Branch:** `phase7/agent-c-formatters`

---

### Agent D: UI Components

**Scope:** Build all React components and CSS modules for the explainability dashboard. Work against the interfaces defined in Agent C (or define prop types locally).

**Tasks:**
- [ ] 3.1.1 — `BreakdownPanel.tsx` container component
- [ ] 3.1.2 — `BreakdownPanel.module.css`
- [ ] 3.2.1 — `ProviderAgreement.tsx` (agree/mixed/disagree badge + provider list)
- [ ] 3.2.2 — `ProviderAgreement.module.css`
- [ ] 3.3.1 — `HeuristicRadar.tsx` (SVG radar chart, 4 axes, human baseline overlay)
- [ ] 3.3.2 — `HeuristicRadar.module.css`
- [ ] 3.3.3 — Signal indicators on each axis
- [ ] 3.3.4 — Hover tooltips with plain-English metric explanations
- [ ] 3.4.1 — `ModalityBreakdown.tsx` (stacked bar with contribution %)
- [ ] 3.4.2 — `ModalityBreakdown.module.css`
- [ ] 3.4.3 — Single-bar fallback for text-only content
- [ ] 3.5.1 — `ImageGrid.tsx` (thumbnail grid with per-image badges)
- [ ] 3.5.2 — `ImageGrid.module.css`
- [ ] 3.6.1 — `FrameTimeline.tsx` (SVG timeline chart)
- [ ] 3.6.2 — `FrameTimeline.module.css`
- [ ] 3.7.1 — `ParagraphHighlighter.tsx` (per-paragraph background coloring)
- [ ] 3.7.2 — `ParagraphHighlighter.module.css`
- [ ] 3.7.3 — Conditional render: only when GPTZero data present
- [ ] 3.8.1 — `BreakdownTeaser.tsx` (blurred preview + upgrade CTA)
- [ ] 3.8.2 — `BreakdownTeaser.module.css`

**Verification:** All components render with mock data; visual check matches retro newspaper design system.

**Branch:** `phase7/agent-d-ui`

---

### Agent E: Integration (Wave 2 — after A, B, C, D merge)

**Scope:** Wire everything together: service layer persistence, MediaScore writes, API endpoint integration, backfill, and consumer page wiring.

**Tasks:**
- [ ] 1.4.1 — Update `analyzeAndStoreScore()` to persist `providerDetails`, `heuristicMetrics`, `fusionDetails`
- [ ] 1.4.2 — Update `analyzeMultiModalAndStore()` to persist all JSONB fields + write MediaScore records
- [ ] 1.4.3 — Update `MultiModalAnalyzeResult` interface
- [ ] 1.4.4 — Update `AnalyzeContentResult` interface
- [ ] 1.2.1 — Query created ContentMedia IDs after image creation
- [ ] 1.2.2 — Write MediaScore rows for each image
- [ ] 1.2.3 — Write MediaScore row for video with aggregated frame score
- [ ] 1.5.1 — Create `POST /api/admin/backfill-explainability` endpoint
- [ ] 1.5.2 — Add `hasExplainability` check (`providerDetails IS NOT NULL`)
- [ ] 1.5.3 — Make backfill batchable + idempotent
- [ ] 2.3.1–2.3.6 — Wire formatters into Phase 4 API endpoints with tier gating
- [ ] 2.4.2–2.4.3 — Extend API key middleware with tier context + caching
- [ ] 2.5.1–2.5.3 — Consumer tier gating: breakdown page, teaser, `GET /api/content/[id]/breakdown`
- [ ] 3.1.3 — Wire `BreakdownPanel` into content detail page
- [ ] 3.9.2 — Wire `generateExplanation()` into BreakdownPanel

**Verification:** End-to-end: submit a URL → check DB has full JSONB data → call API as free user (basic response) → call as Pro (full breakdown) → view content page as Pro (see dashboard).

**Branch:** `phase7/agent-e-integration` (branched from merged A+B+C+D)

---

## Estimated Timeline

| | Sequential | Parallel (Wave 1 + Wave 2) |
|---|---|---|
| Agent A: Pipeline | 3-4 days | ┐ |
| Agent B: Schema | 0.5 days | │ Wave 1: 3-4 days |
| Agent C: Formatters | 2-3 days | │ (wall clock) |
| Agent D: UI | 4-5 days | ┘ |
| Agent E: Integration | 3-4 days | Wave 2: 3-4 days |
| **Total** | **12-17 days** | **6-8 days** |

---

## Files Changed (Summary)

### Modified:
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 3 JSONB cols to `AiScore`, 1 JSONB col to `MediaScore` |
| `src/lib/ai-detection/types.ts` | Extend result interfaces with breakdown fields |
| `src/lib/ai-detection/composite-score.ts` | Return effective weights and contribution percentages |
| `src/lib/ai-detection/index.ts` | Thread provider metadata through to results |
| `src/lib/ai-detection/providers/heuristic.provider.ts` | Include sub-scores in metadata |
| `src/lib/ai-detection/providers/huggingface.provider.ts` | Include model/truncation info in metadata |
| `src/lib/ai-detection/providers/gptzero.provider.ts` | Include per-paragraph + burstiness in metadata |
| `src/lib/ai-detection/providers/image-local.provider.ts` | Return per-image scores in metadata |
| `src/lib/ai-detection/providers/video.provider.ts` | Return per-frame scores in metadata |
| `src/lib/services/ai-detection.service.ts` | Persist JSONB fields + write MediaScore records |

### New:
| File | Purpose |
|------|---------|
| `src/lib/ai-detection/format-breakdown.ts` | Free/paid response formatting |
| `src/lib/ai-detection/explain-score.ts` | Plain-English score explanation generator |
| `src/lib/api/check-tier.ts` | User/API key tier lookup |
| `src/components/explainability/BreakdownPanel.tsx` | Container component |
| `src/components/explainability/ProviderAgreement.tsx` | Provider agreement badge |
| `src/components/explainability/HeuristicRadar.tsx` | Stylometric radar chart |
| `src/components/explainability/ModalityBreakdown.tsx` | Weight contribution bar |
| `src/components/explainability/ImageGrid.tsx` | Per-image score grid |
| `src/components/explainability/FrameTimeline.tsx` | Video frame timeline |
| `src/components/explainability/ParagraphHighlighter.tsx` | Per-paragraph coloring |
| `src/components/explainability/BreakdownTeaser.tsx` | Free user upgrade CTA |
| `src/app/api/content/[id]/breakdown/route.ts` | Breakdown API for consumer UI |
| `src/app/api/admin/backfill-explainability/route.ts` | Backfill admin endpoint |

---

*Last updated: 2026-02-06*
