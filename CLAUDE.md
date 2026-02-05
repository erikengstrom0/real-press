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
│       ├── analyze/route.ts  # AI detection endpoint (Sprint 2)
│       └── admin/
│           ├── crawl/worker/route.ts  # Job worker (Vercel Cron target)
│           ├── crawl/jobs/route.ts    # Job queue management
│           ├── crawl/seeds/route.ts   # Seed list import
│           └── content/[id]/route.ts  # Content inspection
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
    │   ├── media-extraction.service.ts  # Extract images/videos from URLs
    │   ├── crawl-job.service.ts         # Job queue management
    │   ├── crawl-worker.service.ts      # Job processing
    │   ├── domain-rate-limit.service.ts # Per-domain rate limiting
    │   ├── content-analysis.service.ts  # Stylometric analysis
    │   ├── metadata-extraction.service.ts # HTML metadata extraction
    │   ├── topic-extraction.service.ts  # Topic classification
    │   └── author.service.ts            # Author tracking
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
| Sprint 5 | Production deployment | ✅ Complete |

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

### Sprint 5 Deployment Decisions (2026-02-04)

1. **Docker Optimization for Railway**
   - Multi-stage build to reduce image size (~3GB → ~500MB)
   - CPU-only PyTorch from pytorch.org/whl/cpu (~200MB vs ~2GB full CUDA)
   - Static ffmpeg binary from johnvansickle.com (~80MB vs ~727MB with apt)
   - Shell form CMD (`CMD uvicorn ... --port $PORT`) for dynamic PORT expansion
   - Created `.dockerignore` to speed up builds

2. **Railway Health Check Configuration**
   - Railway sets `PORT` env var directly (no prefix), so read via `os.environ.get("PORT", "8000")`
   - Pydantic's `env_prefix = "ML_"` doesn't apply to Railway's PORT injection
   - Extended `healthcheckTimeout` to 300s for PyTorch cold start model loading
   - Created `railway.toml` with deployment config (builder, healthcheck, restart policy)

3. **Custom Domain Setup (ml.real.press)**
   - Added CNAME record in Cloudflare: `ml` → `real-press-production.up.railway.app`
   - CRITICAL: Use "DNS only" (gray cloud), not "Proxied" (orange cloud)
   - Railway SSL provisioning requires direct DNS, not Cloudflare proxy
   - Custom domain added via Railway dashboard (Settings → Networking → Custom Domains)

4. **Vercel Configuration**
   - `NEXT_PUBLIC_APP_URL` must be set to custom domain (https://www.real.press)
   - Server-side fetch prioritizes `NEXT_PUBLIC_APP_URL` over `VERCEL_URL`
   - `VERCEL_URL` points to deployment URL (real-press-xxx.vercel.app), not custom domain
   - This fixes search API calls failing in production

5. **Database Schema Sync**
   - Run `npx prisma db push` after any Prisma schema changes
   - Production database schema must match `prisma/schema.prisma`
   - Error "column does not exist" indicates schema mismatch
   - Prisma migrate is for development; db push is for quick sync

6. **User-Friendly Extraction Errors**
   - Added comprehensive HTTP error handling in `extraction.service.ts`
   - 403 Forbidden: Explains anti-bot protection (Reddit, Twitter/X, LinkedIn)
   - 401 Unauthorized: Content requires login
   - 404 Not Found: Page doesn't exist
   - 429 Too Many Requests: Rate limiting
   - 5xx Server Errors: Website issues
   - DNS errors (ENOTFOUND): URL spelling issues
   - Timeout errors: Website response time

7. **Environment Variables Added**
   - `NEXT_PUBLIC_APP_URL` - Custom domain for Vercel (https://www.real.press)
   - `ML_SERVICE_URL` - ML service URL (https://ml.real.press)
   - `DATABASE_URL` - Neon connection string (in Vercel env vars)

### Web Scraper Architecture Decisions (2026-02-04)

1. **Two Separate Flows**
   - **User submissions**: Stay synchronous (immediate feedback)
   - **Web scraper**: Async queue for background discovery
   - Both flows share the same Content + AiScore tables
   - User submissions do NOT go through CrawlJob queue

2. **MVP Queue Technology**
   - PostgreSQL-backed queue (no new infrastructure)
   - Vercel Cron triggers worker every minute
   - Upgrade path to Redis/BullMQ when volume grows

3. **Database Models for Scraper**
   - `CrawlJob`: Queue with status (PENDING → PROCESSING → COMPLETED/FAILED)
   - `Domain`: Per-domain rate limiting, robots.txt cache
   - `CrawlSource`: RSS feeds and sitemaps to monitor
   - `CrawlMetric`: Hourly aggregates for observability

4. **Rate Limiting Strategy**
   - Per-domain throttling (respect robots.txt)
   - Configurable crawl delay per domain
   - Exponential backoff for retries
   - Dead letter queue for permanent failures

### Content Metadata Architecture (2026-02-04)

1. **Extended Content Model**
   - Publication: publishedAt, author, language
   - Metrics: wordCount, sentenceCount, paragraphCount, readingLevel
   - Links: linkCount, externalLinkCount, imageCount, hasVideo
   - Stylometric: vocabularyDiversity, avgSentenceLength, sentenceLengthVariance, punctuationDiversity, repetitionScore
   - NLP: sentimentScore, namedEntityDensity, temporalReferenceDensity
   - Provenance: canonicalUrl, siteName, ogType, schemaType
   - History: contentVersions[], scoreHistory[]

2. **New Tables for Analysis**
   - `Author`: Track authors across articles with avgScore
   - `Topic`: Taxonomy-based topic classification
   - `ContentTopic`: Many-to-many content-topic relations
   - `DomainStats`: Time-series domain analytics

3. **Content Analysis Service**
   - Flesch-Kincaid reading level calculation
   - Vocabulary diversity (type-token ratio)
   - Sentence length variance (coefficient of variation)
   - Repetition detection (n-gram analysis)
   - Sentiment analysis (positive/negative word lexicon)
   - Named entity density (pattern-based extraction)
   - Temporal reference density (date/time patterns)

4. **Topic Extraction**
   - Predefined taxonomy with 16 topics (technology, AI, startup, etc.)
   - Keyword matching with unigrams, bigrams, trigrams
   - Relevance scoring based on match density
   - Up to 5 topics per article

5. **Metadata Extraction from HTML**
   - Published date: Open Graph, Schema.org, Dublin Core, time elements
   - Author: meta tags, Schema.org, byline patterns
   - Site info: og:site_name, canonical URL, og:type

### Web Scraper Testing & HuggingFace Fixes (2026-02-04)

1. **Scraper Local Testing Completed**
   - Tested full scraper pipeline: job queue → content extraction → metadata → AI detection → topics
   - All components verified working: author extraction, published dates, reading level, topics
   - Sample result: "Back to Basics" by Joel Spolsky classified as "human" with 0.097 composite score

2. **HuggingFace API Migration**
   - Old endpoint `api-inference.huggingface.co` deprecated (returns 410)
   - New endpoint: `router.huggingface.co/hf-inference/models/{model}`
   - Updated in `src/lib/ai-detection/providers/huggingface.provider.ts`

3. **HuggingFace Token Authentication**
   - New router endpoint requires API token (old endpoint worked without)
   - Token created and saved to `.env`: `HUGGINGFACE_API_TOKEN`
   - Token also saved to Claude memory: `~/.claude/projects/-Users-erikengstrom/memory/MEMORY.md`

4. **Text Truncation Bug Fix**
   - RoBERTa model has 514 token limit (~4 chars/token average)
   - Old truncation: 5000 chars → caused "tensor size mismatch" errors
   - Fixed truncation: 1800 chars → safely fits within token limit
   - Error message: "The expanded size of the tensor (1184) must match the existing size (514)"

5. **Commit Created: `78fa44e`**
   - "Add web scraper system with metadata extraction and topic classification"
   - 20 files changed, 2383 insertions
   - Pushed to `main` branch

6. **Scraper Admin API Endpoints**
   - `POST /api/admin/crawl/worker` - Process batch of jobs (Vercel Cron target)
   - `GET/POST /api/admin/crawl/jobs` - List/create crawl jobs
   - `GET/POST /api/admin/crawl/seeds` - List/import seed URL lists
   - `GET /api/admin/content/[id]` - Get content with full metadata

7. **Testing Commands**
   ```bash
   # Import seed URLs
   curl -X POST http://localhost:3000/api/admin/crawl/seeds -H 'Content-Type: application/json' -d '{"file": "tech-essays"}'

   # Run worker batch
   curl -X POST http://localhost:3000/api/admin/crawl/worker -H 'Content-Type: application/json' -d '{"batchSize": 5}'

   # Check job stats
   curl "http://localhost:3000/api/admin/crawl/jobs?stats=true"

   # View content with metadata
   curl "http://localhost:3000/api/admin/content/{id}"
   ```

8. **Production Deployment Next Steps**
   - Schema already pushed to Neon (verified in sync)
   - Add `CRON_SECRET` env var in Vercel for worker authentication
   - Set up external cron (cron-job.org) to trigger `/api/admin/crawl/worker` every 5 min

### Scraper Cron Deployment (2026-02-05)

1. **External Cron Service (cron-job.org)**
   - Vercel Hobby limits cron to 1x/day - insufficient for scraper
   - Using free external cron service: https://cron-job.org
   - Configure job to call `POST https://www.real.press/api/admin/crawl/worker`
   - Add header: `Authorization: Bearer <CRON_SECRET>`
   - Recommended schedule: every 5 minutes (`*/5 * * * *`)

2. **CRON_SECRET Authentication**
   - Worker endpoint validates `Authorization` header against `CRON_SECRET` env var
   - Falls back to allowing requests when `CRON_SECRET` not set (dev mode)
   - `CRON_SECRET` set in Vercel environment variables

3. **Build Script Fix**
   - Added `prisma generate` to build script: `"build": "prisma generate && next build"`
   - Added `postinstall` script as backup: `"postinstall": "prisma generate"`
   - Required because generated Prisma files are gitignored (correct for generated code)
   - Ensures new schema models (CrawlJob, Author, Topic, etc.) are generated on deploy

4. **Environment Variables**
   - `CRON_SECRET` - Secure token for worker authentication (set in Vercel)
   - Generated with `openssl rand -hex 32`

5. **Cron Worker Behavior**
   - Processes 5 jobs per batch by default
   - Max concurrency of 3 parallel job processing
   - 60 second max duration (Vercel function limit)
   - Returns processed/failed counts for monitoring

6. **External Cron Setup Instructions**
   ```
   1. Go to https://cron-job.org and create free account
   2. Create new cron job:
      - URL: https://www.real.press/api/admin/crawl/worker
      - Method: POST
      - Schedule: Every 5 minutes
      - Headers: Authorization: Bearer <your-CRON_SECRET>
   3. Enable and save
   ```

### Styling & Cross-Browser Fixes (2026-02-05)

1. **Home Page Left-Justified Layout**
   - Changed from center-justified to left-justified layout
   - Max-width constrained to 900px for readability
   - Title "Real Press" uses masthead-style bold ink lines (above/below)
   - Double-line dividers between sections (matching demo page style)

2. **Home Page Color Usage**
   - Feature cards have colored top borders: green, gold, light sky
   - Card hover changes background to Light Ghost (#F7F3F7)
   - Footer tagline glows Light Sky on hover
   - Title size matches Style Guide (--text-6xl)

3. **SearchBar Keyboard Support**
   - Added explicit `onKeyDown` handler for Enter key
   - Added native form fallback with `action="/search"` and `method="get"`
   - Changed input to `type="search"` with `name="q"`
   - Fixed cross-browser compatibility (Brave, Safari)

4. **AI Score Badge Cross-Browser Fixes**
   - Removed `filter: blur()` from stamp variations (caused invisible text in Safari/Brave)
   - Removed complex SVG `mask-image` from `::after` pseudo-element
   - Simplified `::before` glow effect (removed blur filter)
   - Commented out random rotation (kept position/opacity/pressure variations)

5. **Search Results Spacing**
   - Symmetric padding (1.25rem) around each result item
   - Hover box extends beyond content with negative margins
   - Divider lines have equal spacing above and below (0.75rem each)
   - Border moved to top of subsequent items for balanced spacing

6. **Filter Panel Mobile Responsive**
   - Controls stack vertically on mobile (<480px)
   - Labels and toggles justified at opposite ends
   - Divider becomes horizontal line between controls
   - Reduced font size and padding for mobile

7. **Favicon**
   - Created `src/app/icon.svg` with green "R" in serif font
   - Uses accent-primary green (#249445) on paper background (#F5F2ED)

---

## Future TODOs

### High Priority (Pre-Funding)
- [ ] **User submission rate limiting** - Protect against abuse/spam
- [ ] **Malicious submission protection** - Validate URLs, block known bad actors
- [ ] **Scale user submissions** - Queue system if concurrent submissions become bottleneck

### Post-Funding Scale
- [ ] Migrate scraper queue from PostgreSQL to Redis/BullMQ
- [ ] Deploy dedicated worker on Railway (vs Vercel Cron)
- [ ] Bloom filter for fast URL deduplication
- [ ] OpenTelemetry metrics and Grafana dashboards
