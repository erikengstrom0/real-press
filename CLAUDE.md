# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real Press is a search engine that surfaces human-generated content with AI detection scores. Every search result displays a classification badge (Human → AI spectrum) so users can find authentic content.

**Goal:** Build a fundable MVP demo for investor meetings.

## Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type check without emitting
npm run type-check

# Prisma commands
npx prisma generate    # Generate client
npx prisma db push     # Push schema to database
npx prisma studio      # Open database GUI
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js (Real Press)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Multi-Modal Orchestrator                   │ │
│  │  detectMultiModalContent(text, images, video)          │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│  ┌─────────────┬───────────┼───────────┬─────────────────┐ │
│  │   Text      │   Image   │   Video   │   Provider      │ │
│  │  Providers  │  Provider │  Provider │   Registry      │ │
│  │ HuggingFace │   Local   │  (Frames) │                 │ │
│  │ GPTZero     │           │           │                 │ │
│  │ Heuristics  │           │           │                 │ │
│  └─────────────┴───────────┴───────────┴─────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│              Python ML Service (FastAPI)                     │
│  - POST /api/detect/image   (CNNDetection model)            │
│  - POST /api/extract-frames (video → frames)                │
│  - GET  /health                                              │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict mode
- **Database**: PostgreSQL via Neon (Prisma 7 ORM)
- **AI Detection**: Multi-modal (text, image, video)
  - Text: Hugging Face (free, primary) + GPTZero API (paid, optional) + custom heuristics
  - Image/Video: Python ML service (CNNDetection)
- **Styling**: CSS Modules
- **Hosting**: Vercel (Next.js) + Docker (ML Service)

## Directory Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── layout.tsx            # Root layout
│   ├── search/page.tsx       # Search results
│   ├── submit/page.tsx       # URL submission
│   └── api/
│       ├── search/route.ts   # Search endpoint
│       ├── submit/route.ts   # Submission endpoint
│       └── analyze/route.ts  # AI detection endpoint (Sprint 2)
├── components/
│   ├── SearchBar.tsx
│   ├── SearchResults.tsx
│   ├── AIScoreBadge.tsx      # Color-coded AI score indicator (Sprint 3)
│   ├── SubmitForm.tsx
│   └── FilterPanel.tsx       # Classification filter (Sprint 3)
└── lib/
    ├── db/prisma.ts          # Prisma client singleton
    ├── services/
    │   ├── content.service.ts
    │   ├── extraction.service.ts
    │   ├── ai-detection.service.ts
    │   └── media-extraction.service.ts  # Extract images/videos from URLs
    └── ai-detection/
        ├── index.ts              # Multi-modal orchestrator
        ├── composite-score.ts    # Score calculation
        ├── provider-registry.ts  # Provider management
        ├── types.ts              # Type definitions
        └── providers/
            ├── base.provider.ts       # Abstract base class
            ├── gptzero.provider.ts    # Text: GPTZero API
            ├── heuristic.provider.ts  # Text: Heuristics
            ├── image-local.provider.ts # Image: ML service
            └── video.provider.ts      # Video: Frame analysis

ml-service/                    # Python ML Service
├── app/
│   ├── main.py               # FastAPI app
│   ├── config.py
│   ├── models/
│   │   ├── base.py           # Base detector interface
│   │   └── cnn_detector.py   # CNNDetection wrapper
│   └── routers/
│       ├── image.py          # POST /api/detect/image
│       ├── video.py          # POST /api/extract-frames
│       └── health.py         # GET /health
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## AI Score Classification

| Score | Classification | Badge Color |
|-------|----------------|-------------|
| 0.00-0.15 | `human` | Green |
| 0.15-0.35 | `likely_human` | Light Green |
| 0.35-0.65 | `unsure` | Yellow |
| 0.65-0.85 | `likely_ai` | Orange |
| 0.85-1.00 | `ai` | Red |

## Key Patterns

- Use `@/*` path alias for imports (e.g., `@/components/SearchBar`)
- Client components require `"use client"` directive
- Search queries via URL params (`/search?q=query&filter=human`)
- AI detection runs synchronously on URL submission (MVP)
- Prisma client uses singleton pattern for serverless compatibility
- Prisma 7 uses `@prisma/adapter-neon` for Neon database connections

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."     # Neon connection string (prisma+postgres:// format)

# AI Detection - Text (Hugging Face is FREE and primary)
HUGGINGFACE_API_TOKEN="..."         # Optional: for higher rate limits (works without)
GPTZERO_API_KEY="..."               # Optional: paid backup ($45/month)

# AI Detection - Image/Video (ML Service)
ML_SERVICE_URL="http://localhost:8000"  # Python ML service URL
PROVIDER_IMAGE_ENABLED="true"       # Enable image detection
PROVIDER_VIDEO_ENABLED="true"       # Enable video detection

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Development Plan

Full plan: `DEVELOPMENT_PLAN.md`

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 1 | Database + URL submission | ✅ Complete |
| Sprint 2 | AI detection integration | ✅ Complete |
| Sprint 3 | Search with AI badges | ✅ Complete |
| Sprint 4 | Polish + demo ready | ✅ Complete |
| Sprint 5 | Vercel deployment | 🚀 In Progress |

---

## Sprint Completion Workflow

**At the end of every sprint, follow this workflow:**

### 1. Pre-PR Checklist

Before creating the PR, verify:

- [ ] All sprint tasks are implemented
- [ ] `npm run type-check` passes with no errors
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` completes successfully

### 2. Manual Testing

Test all features implemented in the sprint:

**Sprint 1 (Database + Submission):**
- [ ] `/submit` page loads
- [ ] Can submit a valid URL
- [ ] Duplicate URL is rejected (409)
- [ ] Invalid URL shows error
- [ ] Content appears in database

**Sprint 2 (AI Detection):**
- [ ] Submitted content gets AI score
- [ ] Score and classification stored in database
- [ ] `/api/analyze` returns preview for raw text
- [ ] Content status updates to 'analyzed'

**Sprint 3 (Search + Badges):**
- [ ] Search returns results with AI badges
- [ ] Badge colors match classification
- [ ] Filter by classification works
- [ ] Pagination works

**Sprint 4 (Polish):**
- [ ] Landing page displays correctly
- [ ] Mobile responsive
- [ ] Loading states work
- [ ] Error states display properly

### 3. Create Feature Branch & PR

```bash
# Create branch for the sprint (if not already on one)
git checkout -b sprint-N-description

# Stage and commit all changes
git add .
git commit -m "Sprint N: Brief description of features"

# Push and create PR
git push -u origin sprint-N-description
gh pr create --title "Sprint N: Feature Title" --body "## Summary
- Feature 1
- Feature 2

## Testing Done
- [x] Type check passes
- [x] Lint passes
- [x] Build succeeds
- [x] Manual testing completed

## Test Results
[Include curl commands or screenshots of tested features]"
```

### 4. PR Review Checklist

Before merging, ensure:

- [ ] PR description documents all changes
- [ ] Test results are documented in PR
- [ ] No console errors in browser
- [ ] Database schema changes are noted
- [ ] Environment variable changes are documented

### 5. Merge & Update

After PR is approved:

```bash
# Merge PR (squash recommended for clean history)
gh pr merge --squash

# Update local main
git checkout main
git pull origin main

# Update CLAUDE.md sprint status
# Mark sprint as ✅ Complete
```

---

## Decisions Log

Decisions made during development that should persist across sessions.

### Sprint 1 Decisions (2025-01-27)

1. **Prisma 7 Configuration**
   - Prisma 7 no longer supports `url` in schema datasource block
   - Database URL configured in `prisma.config.ts`
   - Client uses `accelerateUrl` option instead of `datasourceUrl`
   - Generated client output: `src/generated/prisma/`

2. **Content Extraction**
   - Using `@extractus/article-extractor` for URL content extraction
   - Minimum content length: 100 characters (reject shorter content)
   - Content hash generated using SHA-256 for deduplication

3. **Validation**
   - Using Zod for API request validation
   - URL validation: must be valid URL format
   - Duplicate detection: check by URL (unique constraint)

4. **Error Handling**
   - Custom `ExtractionError` class for content extraction failures
   - HTTP 400 for validation errors
   - HTTP 409 for duplicate URLs
   - HTTP 422 for extraction failures
   - HTTP 500 for unexpected errors

5. **Database Schema**
   - `Content` model: stores extracted content with metadata
   - `AiScore` model: one-to-one relation with Content
   - Using snake_case for database column names (`@map`)
   - Cascade delete: AiScore deleted when Content deleted

6. **Component Patterns**
   - CSS Modules for styling (matching existing SearchBar pattern)
   - Client components use `"use client"` directive
   - Form components handle loading/error/success states internally

### Sprint 2 Decisions (2025-01-28)

1. **Prisma 7 Database Adapter**
   - Switched from `accelerateUrl` to `@prisma/adapter-neon` for direct Neon connections
   - Prisma 7 requires either `adapter` or `accelerateUrl` in PrismaClient constructor
   - Using `@neondatabase/serverless` under the hood

2. **AI Detection Architecture**
   - Two-provider system: GPTZero API (primary) + Heuristics (fallback)
   - Composite score combines both with confidence-based weighting
   - GPTZero weight: 70%, Heuristic weight: 30% (when both available)
   - Falls back to heuristics-only when GPTZero unavailable

3. **Heuristic Detection Algorithm**
   - Analyzes: vocabulary diversity, sentence length variation, punctuation variety
   - Minimum 50 words required for meaningful analysis
   - Score weights: vocabulary (35%), variation (30%), length (20%), punctuation (15%)
   - AI-generated text tends to have lower vocabulary diversity and more uniform sentences

4. **Score Classification Thresholds**
   - `human`: 0.00-0.15 (green)
   - `likely_human`: 0.15-0.35 (light green)
   - `unsure`: 0.35-0.65 (yellow)
   - `likely_ai`: 0.65-0.85 (orange)
   - `ai`: 0.85-1.00 (red)

5. **API Endpoints**
   - `/api/submit` - Extracts content AND runs AI detection synchronously
   - `/api/analyze` - Preview mode (text only) or re-analyze existing content
   - Content status updated to 'analyzed' after successful detection

### Sprint 3 Decisions (2025-01-28)

1. **Search Implementation**
   - Case-insensitive search across title, description, content text, and URL
   - Searches only content with status='analyzed'
   - Results ordered by creation date (newest first)
   - Pagination with 10 results per page

2. **Classification Filter**
   - Filter by AI classification: human, likely_human, unsure, likely_ai, ai
   - Filter applied via query parameter: `/search?q=query&filter=human`
   - "All Results" option shows unfiltered results
   - Filter resets to page 1 when changed

3. **AIScoreBadge Component**
   - Color-coded badges: green (human) → red (AI)
   - Three sizes: small, medium, large
   - Optional score percentage display
   - Dot indicator matches classification color

4. **URL Normalization**
   - Accepts flexible input: `example.com`, `www.example.com`, `https://example.com`
   - Automatically adds `https://` if protocol missing
   - Blocks dangerous protocols (javascript:, data:, etc.)
   - Real-time validation feedback in submit form

5. **Search Results Display**
   - Title links to original URL (opens in new tab)
   - Domain shown below title
   - Description truncated to 2 lines
   - AI badge prominently displayed with score

### Sprint 4 Decisions (2025-01-28)

1. **Landing Page Branding**
   - "Real Press" logo prominently displayed at top
   - Tagline: "A Search Engine for the Human Web"
   - Value proposition explains the problem (AI content flooding) and solution
   - No emojis in feature cards - clean, professional look

2. **Score Display Inversion**
   - Internal score: 0 = human, 1 = AI (matches GPTZero)
   - Display score: 100% = human, 0% = AI (user-friendly)
   - Formula: `humanPercentage = (1 - score) * 100`
   - Reasoning: Users intuitively expect higher = better

3. **Filter Toggle UX**
   - iOS-style toggle switches instead of button groups
   - Two toggles: "Human Only" (filter) and "Sort by Score" (sort)
   - Results update without page refresh (client-side fetch)
   - URL updates via `history.replaceState` for bookmarking

4. **Client-Side Search Results**
   - `SearchResultsContainer` manages filter/sort state
   - Initial results from server, updates via client fetch
   - Loading spinner shown during filter changes
   - Page stays still while results update

5. **Duplicate URL Feedback**
   - When user submits URL that already exists, show existing analysis
   - Returns 409 status with `exists: true` flag
   - Displays title, URL, and Human Score of existing content
   - Blue info box differentiates from new submission (green)

6. **Loading & Error Components**
   - `LoadingSpinner`: small/medium/large sizes with optional message
   - `ErrorMessage`: title, message, and optional retry button
   - `loading.tsx` and `error.tsx` for search page boundaries

7. **Mobile Responsive Breakpoints**
   - Tablet: 768px (single column features, smaller text)
   - Mobile: 480px (compact padding, stacked layout)
   - All pages tested for responsive behavior

8. **CSS Modules Consistency**
   - All pages now use CSS modules (removed inline styles from submit page)
   - Consistent color palette across components
   - Green (#22c55e) for human/positive, Red (#ef4444) for AI/errors

### Multi-Modal Detection Decisions (2025-01-28)

1. **Provider Architecture**
   - Abstract `BaseProvider` class for all detection providers
   - `ProviderRegistry` for dynamic provider management
   - Each provider declares supported content types
   - Providers return `null` when unavailable or on error

2. **Multi-Modal Scoring System**
   - Unified 0-100 scoring (100 = human, 0 = AI)
   - Internally 0.0-1.0 (0 = human, 1 = AI), display inverts
   - Confidence-based weighting for composite scores
   - Base weights: Text (50%), Image (35%), Video (15%)

3. **Image Detection**
   - Python ML service using CNNDetection model
   - ResNet50 backbone for feature extraction
   - Confidence calculated from score distance from 0.5
   - Supports URL or base64 input

4. **Video Detection**
   - Frame extraction via ML service (max 20 frames)
   - Each frame analyzed with image detector
   - Variance-adjusted confidence (high variance = low confidence)
   - Batched processing with concurrency limit

5. **Database Schema Extensions**
   - `ContentMedia` model for images/videos
   - `MediaScore` model for per-media scores
   - `AiScore` extended with per-type scores and confidence
   - `analyzedTypes` array tracks which types were analyzed

6. **API Changes**
   - `/api/submit` accepts `imageUrls`, `videoUrl`, `extractMedia`
   - `/api/analyze` supports multi-modal preview
   - Backwards compatible with text-only requests

7. **ML Service Design**
   - FastAPI with async endpoints
   - Docker deployment with docker-compose
   - Health check endpoint for monitoring
   - CPU-friendly (no GPU required for MVP)

### Design System Decisions (2026-01-29)

1. **1920s-30s Retro Newspaper Aesthetic**
   - Typography: Caudex (headlines) + Lato (body)
   - Color palette: warm paper tones, muted colors
   - Square corners instead of rounded (4px max)
   - Removed paper texture (too noisy for screens)

2. **Color Palette**
   - Primary: `#249445` (Medium Jungle Green)
   - Secondary: `#9CE7B3` (Celadon - light green)
   - Gold: `#F3D653` (Royal Gold - highlights)
   - Sky: `#C9E0F8` (Pale Sky - info states)
   - Neutrals: Paper (#F5F2ED), Cream (#FAF8F5), Charcoal (#2D2A26), Ink (#1A1816)

3. **AI Score Stamp Design**
   - Rubber stamp aesthetic with random imperfections
   - Random rotation (-3° to 3°), opacity (0.85-1.0), position shift
   - Uneven pressure shadows for authenticity
   - Color-coded: Human (green) → Unsure (grey) → AI (muted red)
   - Three sizes: small, medium, large

4. **Stamp Variations Utility**
   - `src/lib/utils/stamp-variations.ts` generates random stamp styles
   - `getStampStyles()` returns inline CSS for random variations
   - `getStampClass()` maps classification to CSS class
   - Applied via `useMemo` to persist across re-renders

5. **CSS Architecture**
   - Global design tokens in `globals.css` (CSS custom properties)
   - Component styles use CSS Modules importing design tokens
   - All components updated to use `var(--color-*)`, `var(--font-*)`, etc.
   - Removed hardcoded colors (e.g., `#0070f3` → `var(--color-accent-primary)`)

6. **Demo/Style Guide Page**
   - `/demo` route shows all design system elements
   - Color swatches, stamps, typography, buttons, cards
   - Sample search results with all classifications
   - Useful for testing and demonstrating the design

7. **Toggle Switch Styling**
   - Retro style: square corners, border-based design
   - Uses `--color-accent-secondary` for on state
   - Matches newspaper aesthetic (not iOS-style)

### AI Detection Provider Decisions (2026-02-02)

1. **Hugging Face as Primary Text Provider**
   - GPTZero API costs $45/month - too expensive for MVP
   - Hugging Face Inference API is FREE (rate-limited, but sufficient)
   - Uses `roberta-base-openai-detector` model by default
   - Works without API token (token optional for higher rate limits)

2. **Provider Priority**
   - Primary: Hugging Face (free, always available)
   - Secondary: GPTZero (paid, when GPTZERO_API_KEY is set)
   - Fallback: Heuristics (always runs as baseline)
   - Composite score combines API result + heuristics

3. **New Provider File**
   - `src/lib/ai-detection/providers/huggingface.provider.ts`
   - Follows same pattern as GPTZero provider
   - Handles model loading delays with retry logic
   - Handles rate limiting gracefully

4. **Environment Variables**
   - `HUGGINGFACE_API_TOKEN` - Optional, for higher rate limits
   - `HUGGINGFACE_MODEL` - Optional, defaults to roberta-base-openai-detector
   - `GPTZERO_API_KEY` - Optional, only if you want paid backup
