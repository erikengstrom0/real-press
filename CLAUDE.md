# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real Press is a search engine that surfaces human-generated content with AI detection scores. Every search result displays a classification badge (Human → AI spectrum) so users can find authentic content.

**Goal:** Build a fundable MVP demo for investor meetings.

## Release History

| Version | Date | Description |
|---------|------|-------------|
| v1.7.0 | 2026-02-07 | Phase 9: Async submission queue — SubmissionJob model, queue service, worker endpoint, status polling, progress UI |
| v1.6.0 | 2026-02-07 | Phase 8: Malicious submission protection — domain blocklist, URL resolver, content validator, submission guard |
| v1.5.0 | 2026-02-07 | API Usage Quotas — monthly quota enforcement, usage tracking, quota dashboard, API docs page |
| v1.4.0 | 2026-02-07 | Phase 4: Public Verification API — API key auth, verify endpoints, key management UI |
| v1.3.0 | 2026-02-07 | Phase 7 Wave 2: Integration — service persistence, breakdown API, backfill, content detail page |
| v1.2.0 | 2026-02-07 | Phase 7 Wave 1: Explainability pipeline, schema, formatters, UI |
| v1.1.0 | 2026-02-05 | Admin route protection with middleware authentication |
| v1.0.0 | 2026-02-04 | Production deployment with web scraper |

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
│   ├── content/[id]/         # Content detail page (Phase 7)
│   │   ├── page.tsx                    # Server component: article + score
│   │   ├── ContentBreakdownSection.tsx # Client component: fetches & renders breakdown
│   │   └── page.module.css
│   ├── docs/page.tsx            # Public API documentation page
│   ├── profile/usage/page.tsx   # API quota usage dashboard
│   └── api/
│       ├── search/route.ts   # Search endpoint
│       ├── submit/
│       │   ├── route.ts                 # Submission endpoint (async/sync, Phase 9)
│       │   ├── status/[id]/route.ts     # Job status polling (Phase 9)
│       │   └── worker/route.ts          # Cron-triggered queue worker (Phase 9)
│       ├── analyze/route.ts  # AI detection endpoint (Sprint 2)
│       ├── content/[id]/breakdown/route.ts  # Tier-gated breakdown API (Phase 7)
│       ├── user/api-keys/route.ts           # User API key CRUD (Phase 4)
│       ├── user/quota/route.ts              # User quota status API
│       ├── v1/verify/                       # Public verification API (Phase 4)
│       │   ├── _lib/build-score-row.ts      # Detection result → AiScoreRow mapper
│       │   ├── text/route.ts                # POST text verification (+ quota)
│       │   ├── url/route.ts                 # POST URL verification (+ blocklist + quota)
│       │   ├── image/route.ts               # POST image verification (+ quota)
│       │   └── batch/route.ts               # POST batch verification (+ quota)
│       └── admin/
│           ├── crawl/worker/route.ts  # Job worker (Vercel Cron target)
│           ├── crawl/jobs/route.ts    # Job queue management
│           ├── crawl/seeds/route.ts   # Seed list import
│           ├── content/[id]/route.ts  # Content inspection
│           ├── users/[id]/tier/route.ts     # Admin tier setter (Phase 4)
│           ├── backfill-explainability/route.ts  # Backfill JSONB data (Phase 7)
│           └── blocklist/route.ts     # Admin domain blocklist CRUD (Phase 8)
├── components/
│   ├── SearchBar.tsx
│   ├── SearchResults.tsx
│   ├── AIScoreBadge.tsx      # Color-coded AI score indicator (Sprint 3)
│   ├── SubmitForm.tsx
│   ├── FilterPanel.tsx       # Classification filter (Sprint 3)
│   └── explainability/       # Phase 7 explainability dashboard
│       ├── BreakdownPanel.tsx        # Container component
│       ├── ProviderAgreement.tsx     # Provider consensus badge
│       ├── HeuristicRadar.tsx        # SVG radar chart (4 axes)
│       ├── ModalityBreakdown.tsx     # Stacked weight bar
│       ├── ImageGrid.tsx             # Per-image score grid
│       ├── FrameTimeline.tsx         # Video frame timeline
│       ├── ParagraphHighlighter.tsx  # Per-paragraph coloring
│       └── BreakdownTeaser.tsx       # Free user upgrade CTA
└── lib/
    ├── db/prisma.ts          # Prisma client singleton
    ├── config/
    │   └── quotas.ts                 # Monthly quota limits per tier
    ├── security/                     # Phase 8: Malicious submission protection
    │   ├── domain-blocklist.ts       # Hardcoded + DB-backed domain blocklist
    │   ├── url-resolver.ts           # Redirect follower with hop limit
    │   ├── content-validator.ts      # Post-extraction content quality checks
    │   ├── submission-guard.ts       # Per-user/IP submission rate limits
    │   └── submission-log.ts         # Structured JSON logging for forensics
    ├── services/
    │   ├── content.service.ts
    │   ├── extraction.service.ts
    │   ├── ai-detection.service.ts
    │   ├── api-key.service.ts           # API key CRUD + SHA-256 hashing (Phase 4)
    │   ├── quota.service.ts             # Monthly quota tracking + enforcement
    │   ├── media-extraction.service.ts  # Extract images/videos from URLs
    │   ├── crawl-job.service.ts         # Job queue management
    │   ├── crawl-worker.service.ts      # Job processing
    │   ├── domain-rate-limit.service.ts # Per-domain rate limiting
    │   ├── content-analysis.service.ts  # Stylometric analysis
    │   ├── metadata-extraction.service.ts # HTML metadata extraction
    │   ├── topic-extraction.service.ts  # Topic classification
    │   ├── author.service.ts            # Author tracking
    │   └── submission-queue.service.ts  # Async submission queue (Phase 9)
    ├── api/
    │   ├── check-tier.ts             # User/API key tier lookup (Phase 7)
    │   └── verify-auth.ts            # Dual auth + quota check (Phase 4 + Quotas)
    └── ai-detection/
        ├── index.ts              # Multi-modal orchestrator
        ├── composite-score.ts    # Score calculation
        ├── provider-registry.ts  # Provider management
        ├── types.ts              # Type definitions
        ├── format-breakdown.ts   # Free/paid response formatters (Phase 7)
        ├── explain-score.ts      # Plain-English score explanation (Phase 7)
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
| Phase 7 Wave 1 | Explainability pipeline, schema, formatters, UI | ✅ Complete |
| Phase 7 Wave 2 | Integration: persistence, breakdown API, backfill, content page | ✅ Complete |
| Phase 4 | Public Verification API, API key auth, key management UI | ✅ Complete |
| API Quotas | Monthly quota enforcement, usage tracking, quota dashboard, API docs | ✅ Complete |
| Phase 8 | Malicious submission protection — blocklist, URL resolver, content validator, submission guard | ✅ Complete |
| Phase 9 | Async submission queue — SubmissionJob model, worker endpoint, status polling, progress UI | ✅ Complete |

---

## Sprint Completion Workflow

**MANDATORY: At the end of every sprint, you MUST follow ALL steps in this workflow. Do NOT skip any step.**

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

### 3. Update Documentation (MANDATORY)

**You MUST complete ALL of the following documentation updates before creating the PR:**

#### 3a. Update Decisions Log
- Add a new section under "Decisions Log" for this sprint
- Document every technical decision made during the sprint
- Include rationale, alternatives considered, and why the chosen approach was picked
- Follow the existing format (see previous sprint decisions for examples)

#### 3b. Update Future TODOs
- Review and update the "Future TODOs" section
- Mark completed items as `[x]`
- Add any new TODOs discovered during the sprint
- Categorize by priority: High Priority (Pre-Funding) vs Post-Funding Scale
- Remove items that are no longer relevant

#### 3c. Document Gaps and Known Limitations
- Add any gaps, limitations, or technical debt discovered during the sprint to the "Future TODOs" section
- Be specific: describe what the gap is, why it exists, and what would be needed to close it
- Tag items that are intentional trade-offs vs things that should be fixed

#### 3d. Update System Diagrams (MANDATORY if architecture changed)
If the sprint introduced changes to data flows, services, API routes, database schema, external integrations, or service communication:
- **Update `docs/system-diagram.md`** — Update all affected sections (service list, API endpoints, data flows, database schema, etc.)
- **Update `docs/system-diagram.drawio`** — Update the draw.io visual diagrams (all 3 pages: System Architecture, User Submission Flow, AI Detection Pipeline). Add new pages if needed for new flows. This file is in draw.io XML format and can be edited at [app.diagrams.net](https://app.diagrams.net) or with the draw.io VS Code extension.
- **Export SVGs** — After updating the `.drawio` file, export each page as SVG to `docs/` (e.g., `docs/system-architecture.svg`, `docs/submission-flow.svg`, `docs/ai-pipeline.svg`). SVGs render natively on GitHub in PRs, READMEs, and file browsing. To export: open the `.drawio` file in [app.diagrams.net](https://app.diagrams.net) → File → Export as → SVG for each page.
- Even if changes are minor (e.g., a new API route or a new database column), update the diagrams to keep them accurate
- If unsure whether changes warrant a diagram update, update them anyway — stale diagrams are worse than over-updating

**Diagram files:**
| File | Format | Purpose |
|------|--------|---------|
| `docs/system-diagram.md` | Markdown + ASCII | Text-based diagrams, full detail, always readable |
| `docs/system-diagram.drawio` | draw.io XML | Editable visual diagrams (install [draw.io GitHub app](https://github.com/apps/draw-io-app) for in-repo viewing) |
| `docs/*.svg` | SVG exports | Visual diagrams that render natively on GitHub |

#### 3e. Update CLAUDE.md Sprint Status
- Update the sprint table to mark the current sprint as `✅ Complete`
- Update the Release History table with a new version entry
- Update the Directory Structure section if new files/folders were added

### 4. Create Feature Branch & PR

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

## Documentation Updated
- [x] Decisions log updated
- [x] TODOs updated
- [x] Gaps documented
- [x] System diagrams updated — .drawio + SVG exports (if architecture changed)
- [x] CLAUDE.md sprint status updated

## Test Results
[Include curl commands or screenshots of tested features]"
```

### 5. PR Review Checklist

Before merging, ensure:

- [ ] PR description documents all changes
- [ ] Test results are documented in PR
- [ ] No console errors in browser
- [ ] Database schema changes are noted
- [ ] Environment variable changes are documented
- [ ] Decisions log has been updated
- [ ] Future TODOs have been reviewed and updated
- [ ] Gaps and limitations are documented
- [ ] System diagrams reflect current architecture (.drawio + SVG exports)
- [ ] CLAUDE.md sprint status is updated

### 6. Merge & Update

After PR is approved:

```bash
# Merge PR (squash recommended for clean history)
gh pr merge --squash

# Update local main
git checkout main
git pull origin main
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

6. **Style Guide Page**
   - `/styleguide` route shows all design system elements (renamed from `/demo` for clarity)
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

### Admin Route Protection (2026-02-05)

1. **Middleware-Based Authentication**
   - Created `src/middleware.ts` to protect `/admin/*` and `/api/admin/*` routes
   - Matches paths and checks for valid authentication before allowing access
   - Public routes remain unprotected: `/`, `/search`, `/submit`, `/styleguide`
   - Login page (`/admin/login`) explicitly excluded from protection to avoid redirect loops

2. **Authentication Methods**
   - Authorization header: `Bearer <ADMIN_SECRET>`
   - Cookie: `admin_token=<ADMIN_SECRET>`
   - Query param: `?admin_token=<ADMIN_SECRET>` (for initial access, sets cookie)

3. **Login Page**
   - Created `/admin/login` page for token-based authentication
   - Validates token by testing against admin API endpoint
   - Sets cookie on successful authentication for 7 days
   - Redirects to originally requested page after login
   - Uses Suspense boundary for `useSearchParams()` (Next.js static generation requirement)

4. **Cron Worker Compatibility**
   - Worker endpoint (`/api/admin/crawl/worker`) accepts `CRON_SECRET` separately
   - Allows external cron service to trigger worker without admin access
   - CRON_SECRET and ADMIN_SECRET should be different values

5. **Environment Variables**
   - `ADMIN_SECRET` - Token for admin panel access (set in Vercel)
   - `CRON_SECRET` - Token for cron worker (already configured)
   - Both should be generated with `openssl rand -hex 32`

6. **Build Issues Resolved**
   - `useSearchParams()` must be wrapped in `<Suspense>` for Next.js static generation
   - Login page must be excluded from middleware protection to prevent redirect loops

### Content Source Integration Decisions (2026-02-05)

1. **Free API Priority Strategy**
   - Prioritize free/low-cost APIs for MVP phase
   - Document expensive APIs as future TODOs (post-funding)
   - APIs requiring approval processes tracked separately

2. **Implemented Source Integrations**
   - `src/lib/sources/` - New directory for content source integrations
   - Hacker News API: Completely free, no auth, no rate limits
   - DEV.to API: Free, no auth for reading, 30 req/30s limit
   - YouTube Data API: 10,000 units/day free (100 units per search)
   - RSS/Atom feeds: Universal, works with Medium, Substack, any blog

3. **Source Architecture**
   - Each source exports `getUrlsForCrawling()` for easy integration with crawl queue
   - Normalized output format: `{ url, title, author?, metadata }`
   - Platform-specific helpers (e.g., `RSS.Substack.feed('name')`)
   - Curated feed lists for quality content discovery

4. **API Research Findings**
   - Twitter/X: $200-$5,000/month - too expensive for MVP
   - LinkedIn: $1,000s-$10,000s/month - enterprise only
   - NewsAPI.org: Free tier blocked in production, $449+/month
   - Reddit: Opaque pricing, requires pre-approval for all access
   - Facebook/Instagram, TikTok, Pinterest: Free but require app review

5. **Environment Variables**
   - `YOUTUBE_API_KEY` - Optional, required for YouTube source
   - Other sources work without configuration

### Phase 7 Wave 1: Explainability & Analytics (2026-02-07)

1. **Parallel Agent Architecture**
   - Phase 7 split into 5 agents (A–E) across 2 waves for parallel development
   - Wave 1 (A, B, C, D): zero file conflicts, run simultaneously
   - Wave 2 (E): integration agent merges everything after Wave 1
   - File ownership prevents merge conflicts between Wave 1 agents

2. **Schema Migration (Agent B)**
   - Added 3 nullable JSONB columns to `AiScore`: `provider_details`, `heuristic_metrics`, `fusion_details`
   - Added 1 nullable JSONB column to `MediaScore`: `frame_scores`
   - All columns nullable (`Json?`) for backwards compatibility with existing rows
   - Snake_case `@map()` follows existing project convention
   - Database synced via `npx prisma db push` to Neon

3. **Pipeline Metadata Threading (Agent A)**
   - All 5 providers now return rich metadata: feature sub-scores, model info, per-paragraph scores, per-image/per-frame data
   - `CompositeResult.metadata` extended with provider breakdown, fusion weights, feature scores
   - `MultiModalResult.metadata` extended with per-modality effective weights and contribution percentages
   - All new fields are optional — fully backwards compatible for existing callers
   - Heuristic weights extracted to `HEURISTIC_WEIGHTS` constant (0.35/0.30/0.15/0.20)

4. **Response Formatting & Tier Gating (Agent C)**
   - `formatFreeResponse()`: returns only score, classification, confidence, analyzedTypes
   - `formatPaidResponse()`: returns full breakdown with provider details, heuristic signals, fusion weights
   - Anti-gaming: raw thresholds, scoring formulas, feature weights NEVER exposed to users
   - Heuristic values mapped to `'low' | 'neutral' | 'high'` signals with human-baseline ranges
   - Provider agreement: `'agree'` (spread ≤ 0.15), `'mixed'` (≤ 0.30), `'disagree'` (> 0.30)
   - `check-tier.ts` is a stub returning `'free'` — actual tier lookup deferred to Phase 2 (Billing)

5. **Plain-English Explanation Generator**
   - `generateExplanation()` produces 2–3 sentence summaries of detection results
   - No jargon, no percentages — describes signals in human-readable terms
   - Narrates provider agreement, notable heuristic signals, and multi-modal dynamics

6. **Explainability UI Components (Agent D)**
   - 8 React components + CSS modules in `src/components/explainability/`
   - `BreakdownPanel`: container that orchestrates sub-components
   - `ProviderAgreement`: stamp-styled agree/mixed/disagree badge
   - `HeuristicRadar`: pure SVG radar chart (4 axes, human baseline overlay)
   - `ModalityBreakdown`: stacked bar with contribution percentages
   - `ImageGrid`: thumbnail grid with per-image CNN scores
   - `FrameTimeline`: SVG video timeline chart
   - `ParagraphHighlighter`: per-paragraph background coloring (GPTZero only)
   - `BreakdownTeaser`: blurred preview + upgrade CTA for free users

7. **Known Issues from Review**
   - Minor: `sentenceVariation` key mismatch in `explain-score.ts` `describeMetric()` — falls back to generic text instead of intended description
   - `check-tier.ts` always returns `'free'` (intentional stub pending Phase 2)
   - `computeProviderAgreement()` returns `'agree'` when 0 text providers available (edge case, unlikely in practice)

8. **New Files Created**
   - `src/lib/ai-detection/format-breakdown.ts` — Free/paid response formatting
   - `src/lib/ai-detection/explain-score.ts` — Plain-English explanation generator
   - `src/lib/api/check-tier.ts` — User/API key tier lookup
   - `src/components/explainability/*.tsx` + `*.module.css` — 8 UI components + styles

9. **Files Modified**
   - `prisma/schema.prisma` — 4 new JSONB columns
   - `src/lib/ai-detection/types.ts` — 5 new interfaces, extended `CompositeResult` and `MultiModalResult`
   - `src/lib/ai-detection/composite-score.ts` — returns effective weights and contribution %
   - `src/lib/ai-detection/index.ts` — threads provider metadata, tracks availability
   - All 5 providers — enriched metadata (heuristic sub-scores, model info, per-image/frame data)

### Phase 7 Wave 2: Integration (Agent E) (2026-02-07)

1. **Service Layer Persistence**
   - `analyzeAndStoreScore()` now builds and persists `providerDetails`, `heuristicMetrics`, `fusionDetails` JSONB columns
   - `analyzeMultiModalAndStore()` persists all JSONB fields plus writes `MediaScore` records
   - Builder functions extract enriched metadata from `CompositeResult` and `MultiModalResult`
   - Uses `JSON.parse(JSON.stringify(...))` for Prisma JSON column serialization (matches existing pattern in `crawl-job.service.ts`)

2. **MediaScore Wiring**
   - `analyzeMultiModalAndStore()` now creates `MediaScore` rows for each image with per-image CNN scores
   - Video `MediaScore` rows include aggregated score and `frameScores` JSONB column with per-frame breakdown
   - After creating `ContentMedia` records, queries back IDs to link `MediaScore` foreign keys

3. **Breakdown API Endpoint**
   - `GET /api/content/[id]/breakdown` — tier-gated explainability endpoint
   - Free tier: returns `formatFreeResponse()` (score, classification, confidence, analyzedTypes) + `X-Breakdown-Available: true` header
   - Pro/Enterprise tier: returns `formatPaidResponse()` with full provider details, heuristic signals, fusion weights, per-image/video data
   - Returns `{ hasExplainability: false }` for content analyzed before Phase 7
   - Supports `X-User-Tier` header override for development/demo purposes

4. **Backfill Admin Endpoint**
   - `POST /api/admin/backfill-explainability` — re-runs detection on old content missing JSONB data
   - Protected by middleware ADMIN_SECRET authentication (same as all `/api/admin/*` routes)
   - Accepts `{ batchSize }` (default 10, max 50)
   - Uses raw SQL queries to filter `provider_details IS NULL` and update JSONB columns
   - Idempotent: skips rows that already have `providerDetails`
   - Does NOT change original `compositeScore` or `classification` — only populates new JSONB columns

5. **Content Detail Page**
   - New `/content/[id]` route — first public page for viewing individual content
   - Server component fetches content with AI score, renders title, domain, author, published date, classification
   - `ContentBreakdownSection` client component fetches `/api/content/[id]/breakdown`
   - Renders `BreakdownPanel` for pro users, `BreakdownTeaser` for free users
   - Handles missing explainability data gracefully ("analyzed before detailed tracking was available")

6. **Prisma 7 JSON Column Typing**
   - Prisma 7 generated types don't export `Prisma.InputJsonValue` from `@/generated/prisma`; must import from `@/generated/prisma/client`
   - Structured interfaces (e.g., `StoredProviderDetail[]`) can't directly satisfy `InputJsonValue` due to missing index signatures
   - Solution: `JSON.parse(JSON.stringify(value))` strips type info and returns a plain JSON value Prisma accepts
   - For backfill queries: used `$queryRawUnsafe` with `$1::jsonb` casts to avoid Prisma `JsonNullValueFilter` typing issues

7. **Phase 4 API Endpoints**
   - Phase 4 (`/api/v1/verify/*`) endpoints don't exist yet
   - TODO comment added in service file for future integration
   - When created, updated service functions will automatically persist explainability data
   - Route handlers should use `formatFreeResponse`/`formatPaidResponse` based on caller tier

8. **Return Type Backwards Compatibility**
   - `AnalyzeContentResult` and `MultiModalAnalyzeResult` interfaces extended with optional `providerDetails`, `heuristicMetrics`, `fusionDetails`
   - All new fields are optional — existing callers unaffected
   - Function signatures unchanged — no breaking changes

9. **New Files Created**
   - `src/app/api/content/[id]/breakdown/route.ts` — Tier-gated breakdown API
   - `src/app/api/admin/backfill-explainability/route.ts` — Admin backfill endpoint
   - `src/app/content/[id]/page.tsx` — Content detail page (server component)
   - `src/app/content/[id]/ContentBreakdownSection.tsx` — Breakdown rendering (client component)
   - `src/app/content/[id]/page.module.css` — Content page styles

10. **Files Modified**
    - `src/lib/services/ai-detection.service.ts` — Core integration: persistence builders, MediaScore writes, updated interfaces

### Phase 4: Public Verification API (2026-02-07)

1. **API Key Format & Storage**
   - Raw key format: `rp_live_` + 32 hex chars (16 random bytes)
   - Only SHA-256 hash stored in database; raw key shown once at creation
   - `keyPrefix` column stores `rp_live_<first 8 hex>` for user identification
   - Revoked keys keep their row (soft delete via `revokedAt` timestamp)

2. **Dual Authentication (`verify-auth.ts`)**
   - Bearer token checked first: if prefixed `rp_live_`, validated as API key
   - Falls back to NextAuth session cookie for browser-based access
   - Returns `{ userId, tier, authMethod }` or `{ error, status }`
   - `isAuthError()` type guard for clean control flow in route handlers

3. **Verification Endpoint Pattern**
   - All 4 endpoints follow: rate limit → auth → validate → detect → format → respond
   - Rate limits: text (30/min), url (10/min), image (10/min), batch (5/min)
   - Free tier gets `formatFreeResponse()` (score, classification, confidence, analyzedTypes)
   - Pro/Enterprise gets `formatPaidResponse()` (full breakdown with provider details, heuristic signals, fusion weights)
   - `build-score-row.ts` maps `CompositeResult`/`MultiModalResult` → `AiScoreRow` for formatters

4. **Batch Endpoint Tier Limits**
   - Free: max 10 items per batch
   - Pro: max 25 items per batch
   - Enterprise: max 50 items per batch
   - Items processed sequentially with per-item error handling (one failure doesn't abort batch)
   - Supports mixed item types (text, url, image) in a single batch

5. **URL Verification**
   - Reuses `extractContent()` from `extraction.service.ts` for content extraction
   - Optional `extractMedia: true` flag triggers multi-modal analysis via `extractMediaFromUrl()`
   - Extraction errors return 422 with user-friendly messages (from existing `ExtractionError` class)

6. **Middleware Pass-Through**
   - `/api/v1/*` routes added to middleware matcher but immediately pass through
   - Auth handled in route handlers (not middleware) because API key validation requires database lookup
   - Admin tier setter at `/api/admin/users/[id]/tier` protected by existing admin middleware

7. **API Key Management UI**
   - `/profile/api-keys` page with create, copy-once, and revoke flows
   - Raw key shown in a banner after creation with copy button; dismissed with "I've saved this key"
   - Revoke requires confirmation dialog; revoked keys shown in separate section
   - Profile page links to API key management with "Manage API Keys" button

8. **New Files Created**
   - `prisma/schema.prisma` — `ApiKey` model added
   - `src/lib/services/api-key.service.ts` — CRUD + hashing
   - `src/lib/api/verify-auth.ts` — Dual auth utility
   - `src/app/api/v1/verify/{text,url,image,batch}/route.ts` — 4 verification endpoints
   - `src/app/api/v1/verify/_lib/build-score-row.ts` — Detection result mapper
   - `src/app/api/user/api-keys/route.ts` — User key management API
   - `src/app/api/admin/users/[id]/tier/route.ts` — Admin tier setter
   - `src/app/profile/api-keys/page.tsx` + `page.module.css` — Key management UI

9. **Files Modified**
   - `src/lib/utils/rate-limit.ts` — Added 4 verify endpoint rate limits
   - `src/middleware.ts` — Added `/api/v1/*` pass-through + matcher
   - `src/app/profile/page.tsx` + `page.module.css` — Added API key management link

### Search Bugfix: Subsequent Searches Not Updating (2026-02-07)

1. **Root Cause: React `useState` Ignoring Updated Props**
   - `SearchResultsContainer` is a client component initialized with `useState(initialResults)`
   - `useState` only uses the initial value on first mount; subsequent renders ignore the new prop
   - When user searches again via `router.push()`, the server re-fetches correct results but the client component keeps stale state
   - This caused subsequent searches to show results from the first search

2. **Fix: React `key` Prop on SearchResultsContainer**
   - Added `key={query}` to `<SearchResultsContainer>` in `src/app/search/page.tsx`
   - When `key` changes, React unmounts the old component and mounts a new instance
   - New instance correctly initializes `useState` with the updated `initialResults`
   - Chosen over `useEffect` sync approach because it's simpler, more idiomatic, and avoids stale closure issues

3. **Files Modified**
   - `src/app/search/page.tsx` — Added `key={query}` prop (1-line change)

### Search Page Layout & Header UX Polish (2026-02-07)

1. **Search Bar / Filter Panel Right-Edge Alignment**
   - Problem: SearchBar form had `max-width: 600px` while FilterPanel fills the full container width (~800px), causing misaligned right edges
   - Fix: Removed `max-width: 600px` from `.form` in `SearchBar.module.css`
   - Both elements now fill their parent container equally, so left and right edges align
   - The search input uses `flex: 1` to absorb remaining space after the Search button

2. **Header Profile Link → "Account"**
   - Problem: The nav link after the divider displayed `session.user.name || session.user.email`, which showed "REAL PRESS" (the user's display name) — confusing because it matches the site logo
   - Fix: Changed the link text to a static `"Account"` label
   - The link still navigates to `/profile` for account management
   - Clearer UX: distinguishes site branding from user navigation

3. **Files Modified**
   - `src/components/SearchBar.module.css` — Removed `max-width: 600px` from `.form`
   - `src/components/Header.tsx` — Changed profile link text from dynamic user name to "Account"

### "Did You Mean?" Spell Correction for Search (2026-02-07)

1. **pg_trgm Extension for Similarity Matching**
   - Enabled PostgreSQL `pg_trgm` extension on Neon database for trigram-based fuzzy matching
   - Created GIN index `idx_content_title_trgm` on `lower(title)` for fast similarity lookups
   - Similarity threshold set to 0.2 (pg_trgm default is 0.3 — lowered to catch more candidates)
   - Combined with Levenshtein distance ranking (max 3 edits) for best match selection

2. **Pre-Search Spell Check (Intercept Before Navigation)**
   - Spell check runs in the SearchBar *before* navigating to the search results page
   - Dedicated `/api/spell-check?q=...` endpoint returns suggestions without executing the full search
   - On submit, SearchBar calls spell-check API; if a suggestion exists, shows a two-option prompt
   - User must choose "Did you mean: **corrected**?" or "Or search for: **original**" before navigation proceeds
   - If no suggestion, navigates directly — no delay for correctly spelled queries
   - Wrapped in try/catch so spell check failures fall through to normal search

3. **Word-Level Correction Strategy**
   - Query tokenized into words; words <= 2 chars skipped (too short for meaningful correction)
   - Each word matched independently against words extracted from content titles via `unnest(regexp_split_to_array(...))`
   - Candidates ranked by Levenshtein distance first, then pg_trgm similarity as tiebreaker
   - Corrected query reconstructed by replacing only the words that had better matches

4. **fast-levenshtein Package**
   - Added `fast-levenshtein` as explicit dependency (was only a transitive dep in lock file)
   - Created TypeScript declaration at `src/types/fast-levenshtein.d.ts` (no `@types` package exists)
   - Used for candidate ranking and confidence scoring

5. **UI: Two-Option Prompt in SearchBar**
   - `SpellSuggestion` component renders below the search bar input, not in results
   - Two clickable options: corrected query (green, headline font, prominent) and original query (muted, body font)
   - Retro newspaper aesthetic: cream background, green left border, Caudex headline font for suggestion
   - Search button shows "Checking..." state while spell-check API is in-flight
   - Input clears suggestion when user types a new query
   - Mobile responsive with smaller font sizes at 480px breakpoint

6. **SearchBar State Machine**
   - Three states: idle (normal), checking (spell-check API in-flight), prompted (showing two options)
   - In "checking" state: input and button disabled, button text changes to "Checking..."
   - In "prompted" state: SpellSuggestion banner visible below search bar
   - Selecting either option clears the prompt and navigates to `/search?q=<chosen>`
   - Typing new text resets back to idle state

7. **Files Created**
   - `src/lib/services/spell-check.service.ts` — Core spell correction logic
   - `src/types/fast-levenshtein.d.ts` — TypeScript declaration
   - `src/app/api/spell-check/route.ts` — Dedicated spell-check API endpoint
   - `src/components/SpellSuggestion.tsx` — Two-option prompt component
   - `src/components/SpellSuggestion.module.css` — Prompt styles

8. **Files Modified**
   - `src/components/SearchBar.tsx` — Intercepts submit, calls spell-check API, shows prompt
   - `src/components/SearchBar.module.css` — Added wrapper class for layout
   - `src/app/api/search/route.ts` — Removed spell check (moved to dedicated endpoint)
   - `src/components/SearchResultsContainer.tsx` — Removed suggestion prop (no longer needed)

### API Usage Quotas (2026-02-07)

1. **Monthly Quota Limits by Tier**
   - Free: 100 requests/month
   - Pro: 5,000 requests/month
   - Enterprise: 50,000 requests/month
   - Quota resets on the 1st of each month (UTC)
   - Batch endpoint: each item counts as one request toward quota

2. **Quota Enforcement in `verify-auth.ts`**
   - `verifyAuth()` now checks `checkQuota()` after authentication, before processing
   - Returns `429` with `X-Quota-*` headers when monthly quota exceeded
   - All verify endpoints return `X-Quota-Limit`, `X-Quota-Remaining`, `X-Quota-Used`, `X-Quota-Reset` headers
   - `quotaHeaders()` utility builds standard header object from `QuotaStatus`

3. **ApiUsage Model (Schema)**
   - New `ApiUsage` model in `prisma/schema.prisma` tracks individual API requests
   - Fields: `userId`, `apiKeyId` (nullable), `endpoint`, `createdAt`
   - Indexed on `[userId, createdAt]` for efficient monthly count queries
   - `recordApiUsage()` is fire-and-forget (`.catch(() => {})`) to avoid blocking responses

4. **Quota Dashboard (`/profile/usage`)**
   - Visual progress bar with color-coded states (green → orange at 80% → red at 100%)
   - Shows used/limit counts, percentage, remaining, and reset date
   - Fetches from `GET /api/user/quota` endpoint (NextAuth session auth)

5. **API Documentation Page (`/docs`)**
   - Public page documenting all verification endpoints with curl examples
   - Documents authentication, quotas, response formats, classifications, error codes
   - Links to API key management and usage dashboard

6. **Batch Quota Pre-Check**
   - Batch endpoint checks `authResult.quotaStatus.remaining < itemCount` before processing
   - Returns descriptive error with remaining vs. requested counts

7. **New Files Created**
   - `src/lib/config/quotas.ts` — Quota constants and `QuotaStatus` interface
   - `src/lib/services/quota.service.ts` — `getQuotaStatus()`, `checkQuota()`, `recordApiUsage()`
   - `src/app/api/user/quota/route.ts` — User quota status API
   - `src/app/profile/usage/page.tsx` + `page.module.css` — Quota dashboard UI
   - `src/app/docs/page.tsx` + `page.module.css` — Public API documentation

8. **Files Modified**
   - `prisma/schema.prisma` — Added `ApiUsage` model, added `apiUsage` relation on `User`
   - `src/lib/api/verify-auth.ts` — Integrated quota check, added `apiKeyId`/`quotaStatus` to result, added `quotaHeaders()`
   - `src/app/api/v1/verify/{text,url,image,batch}/route.ts` — Added quota headers and usage recording
   - `src/app/profile/page.tsx` — Added "View API Usage" link
   - `src/lib/services/api-key.service.ts` — Returns `apiKeyId` from validation

### Phase 8: Malicious Submission Protection (2026-02-07)

1. **Domain Blocklist Architecture**
   - Two-layer approach: hardcoded blocklists (URL shorteners, spam TLDs) + dynamic database table (`BlockedDomain`)
   - `isDomainBlocked()` checks hardcoded list first, then queries DB — fail-open on database errors
   - Pattern matching supports exact domain, wildcard prefix (`*.example.com`), and suffix match
   - `isSuspiciousUrl()` runs heuristic checks: TLD, URL length, encoding density, subdomain depth, query string length
   - URL shorteners detected by hostname against a curated set of 22 known shortener domains

2. **URL Redirect Resolution**
   - `resolveUrl()` follows HTTP redirects with configurable hop limit (default 5)
   - Each hop validated against SSRF protection AND domain blocklist
   - Uses `HEAD` requests with `redirect: 'manual'` to avoid downloading content
   - 10-second timeout per resolution attempt
   - Only triggered when `isUrlShortener()` returns true (not for all URLs)

3. **Content Validation**
   - Minimum 200 characters of meaningful text (up from 100 in extraction service)
   - Maximum 500,000 characters to prevent memory abuse
   - Pattern matching detects login/paywall/cookie-consent pages (10 patterns)
   - Index/listing page detection (4 patterns) on first line
   - Non-text content rejection (HTML-only, numbers/punctuation-only)
   - TypeScript regex compatibility: avoided `s` (dotAll) and `u` (unicode) flags since tsconfig has no explicit target

4. **Per-User Submission Guard**
   - Authenticated users: 20 submissions/day, 100/week
   - Burst detection: 3+ submissions in 5 minutes triggers temporary cooldown
   - Anonymous: global safety valve (50/day across all anonymous users)
   - Uses `Content` table counts (sourceType='user_submitted') — no additional tables needed
   - Fail-open on database errors to avoid blocking legitimate users

5. **Structured Submission Logging**
   - `logSubmission()` writes JSON to stdout (captured by Vercel logs)
   - Fields: type, timestamp, userId, ip, url, outcome (success/blocked/failed), reason
   - Fire-and-forget, wrapped in try/catch — never throws
   - All blocked and successful submissions logged for abuse forensics

6. **Admin Blocklist API**
   - `GET /api/admin/blocklist` — List all blocked domains (sorted by createdAt desc)
   - `POST /api/admin/blocklist` — Add domain pattern with optional reason (409 on duplicate)
   - `DELETE /api/admin/blocklist` — Remove domain pattern (404 if not found)
   - Protected by existing admin middleware (ADMIN_SECRET)
   - Patterns stored lowercase, trimmed

7. **Submit Endpoint Security Pipeline**
   - After SSRF check, new pipeline runs: blocklist → suspicious URL → URL shortener resolution → submission guard → (extraction) → content validation
   - Suspicious URLs blocked with 403 (not just logged)
   - URL shorteners resolved to final destination before processing
   - Content validation runs post-extraction, before database insert

8. **Verify URL Endpoint Protection**
   - `isDomainBlocked()` check added to `/api/v1/verify/url` before content extraction
   - Returns 403 "This URL cannot be verified" for blocked domains

9. **Schema Changes**
   - `BlockedDomain` model: `pattern` (unique), `reason`, `addedBy`, `createdAt`
   - Mapped to `blocked_domains` table
   - Pushed to Neon production database

10. **New Files Created**
    - `src/lib/security/domain-blocklist.ts` — Hardcoded + DB-backed domain blocklist
    - `src/lib/security/url-resolver.ts` — Redirect follower with hop limit
    - `src/lib/security/content-validator.ts` — Post-extraction content quality checks
    - `src/lib/security/submission-guard.ts` — Per-user/IP submission rate limits
    - `src/lib/security/submission-log.ts` — Structured JSON logging for forensics
    - `src/app/api/admin/blocklist/route.ts` — Admin CRUD for domain blocklist

11. **Files Modified**
    - `prisma/schema.prisma` — Added `BlockedDomain` model
    - `src/app/api/submit/route.ts` — Full security pipeline integration
    - `src/app/api/v1/verify/url/route.ts` — Domain blocklist check

### Phase 9: Async Submission Queue (2026-02-07)

1. **Async/Sync Hybrid Architecture**
   - Not a full cutover: submit endpoint dynamically chooses sync vs async per-request
   - Decision based on queue depth: if < 3 items queued and nothing processing → sync (instant results)
   - If ≥ 3 queued or any jobs processing → async (enqueue + return job ID)
   - Rationale: avoids degrading UX during light load while scaling under heavy load
   - Threshold constant `SYNC_THRESHOLD = 3` is tunable without code changes

2. **Separate Queue from Crawler**
   - Created `SubmissionJob` model separate from `CrawlJob` — different lifecycle and fields
   - User submissions need: userId, tier-based priority, stage progress, media options
   - Crawl jobs need: domain rate limiting, robots.txt, source tracking, metadata
   - Shared infrastructure would over-couple two distinct use cases
   - Both share the same `Content` + `AiScore` tables as output

3. **Priority Queue Design**
   - Priority is an integer column: FREE=0, PRO=10, ENTERPRISE=20
   - Query orders by `priority DESC, createdAt ASC` (highest priority first, then FIFO)
   - Gap between tiers (0, 10, 20) leaves room for future granularity (e.g., priority boosts)
   - Claim uses `updateMany` with status guard for atomic job acquisition (prevents double-processing)

4. **Retry Strategy**
   - Jobs retry up to 3 times on transient failures (network errors, timeouts, 5xx)
   - Permanent errors (403 Forbidden, 404 Not Found, 401 Unauthorized) fail immediately
   - On retry: job returns to QUEUED with `startedAt` cleared, `attempts` incremented
   - On permanent fail: job set to FAILED with `completedAt` and error message preserved

5. **Progress Tracking Stages**
   - Three stages tracked in `stage` column: `'extracting'` → `'analyzing'` → `'complete'`
   - `progress` column (0-100) updated at key milestones: 10 (start), 40 (extracted), 50 (analyzing), 70 (detection running), 100 (done)
   - Frontend maps stages to human-readable labels: "Extracting content..." → "Running AI detection..." → "Complete!"
   - Stage + progress cleared on retry to reset UI state

6. **Duplicate Detection During Queue Wait**
   - Worker checks `getContentByUrl()` before extracting, in case another submission or crawl job analyzed the same URL while this job waited
   - If duplicate found: marks job as COMPLETED linking to existing content, skips extraction + detection
   - Prevents wasted processing for popular URLs submitted by multiple users

7. **Frontend Polling State Machine**
   - Five states: `idle → submitting → queued → processing → complete/error`
   - Polling interval: 2 seconds via `setInterval` (cleared on completion, error, or unmount)
   - Sync submissions skip polling entirely — result displayed immediately
   - Error state shows retry button that resets to idle
   - Progress bar width transitions smoothly via CSS `transition: width 0.4s ease`

8. **Worker Authentication**
   - Reuses same `CRON_SECRET` pattern as crawl worker
   - Both dev mode (no secret = allow all) and production (Bearer token required)
   - No need for a separate secret — worker is non-admin, same trust level as crawl
   - Worker route is under `/api/submit/worker` (not `/api/admin/`) so admin middleware doesn't intercept

9. **Status Endpoint Design**
   - Job ID is a CUID (unguessable), so no auth required for polling — avoids session dependency
   - Terminal states (completed/failed) return `Cache-Control: public, max-age=60`
   - Active states (queued/processing) return `Cache-Control: no-cache, no-store`
   - Queue position calculated on each poll for accuracy (not cached from enqueue time)

10. **Schema Decisions**
    - `contentId` is `@unique` on SubmissionJob — a URL can only produce one content record per job
    - `userId` uses `onDelete: SetNull` (not Cascade) — job history preserved even if user deleted
    - `imageUrls` stored as `String[]` array — simpler than separate table for MVP
    - Composite index `[status, priority, createdAt]` optimizes the claim query directly

11. **New Files Created**
    - `prisma/schema.prisma` — `SubmissionJob` model + `SubmissionStatus` enum
    - `src/lib/services/submission-queue.service.ts` — Queue operations (enqueue, process, status, stats)
    - `src/app/api/submit/worker/route.ts` — Cron-triggered worker endpoint
    - `src/app/api/submit/status/[id]/route.ts` — Job status polling endpoint

12. **Files Modified**
    - `src/app/api/submit/route.ts` — Added async/sync decision logic, enqueue path
    - `src/components/SubmitForm.tsx` — Polling state machine, progress bar, retry button
    - `src/components/SubmitForm.module.css` — Progress bar, stage label, retry button styles

---

## Future TODOs

### Recently Completed
- [x] **Phase 9: Async submission queue** - SubmissionJob model, queue service, worker, status polling, progress UI (2026-02-07)
- [x] **Phase 8: Malicious submission protection** - Domain blocklist, URL resolver, content validator, submission guard, admin blocklist API (2026-02-07)
- [x] **API Usage Quotas** - Monthly quota enforcement, usage tracking, quota dashboard, API docs page (2026-02-07)
- [x] **API documentation page** - Public docs at `/docs` with code examples (2026-02-07)
- [x] **API key usage tracking** - `ApiUsage` model + `/profile/usage` dashboard (2026-02-07)
- [x] **Malicious submission protection** - Blocklist, URL shortener resolution, content validation, per-user rate limits (2026-02-07)
- [x] **"Did You Mean?" spell correction** - Pre-search spell check in SearchBar with two-option prompt before navigation (2026-02-07)
- [x] **Phase 4: Public Verification API** - API key auth, verify endpoints (text/url/image/batch), key management UI, admin tier setter (2026-02-07)
- [x] **Phase 7 Wave 2 (Agent E)** - Integration: service persistence, breakdown API, backfill endpoint, content detail page (2026-02-07)
- [x] **Phase 7 Wave 1** - Explainability pipeline, schema, formatters, UI components (2026-02-07)
- [x] **Admin route protection** - Middleware authentication for `/admin/*` routes (2026-02-05)

### High Priority (Pre-Funding)
- [ ] **Push ApiUsage schema to Neon** - Run `npx prisma db push` to create the `api_usage` table in production. Without this, quota tracking will fail at runtime.
- [ ] **Run backfill on production** - Call `POST /api/admin/backfill-explainability` to populate JSONB data for existing content
- [ ] **Fix `sentenceVariation` key mismatch** - `explain-score.ts` describeMetric() lookup mismatches output key (minor bug, falls back to generic text)
- [x] ~~**Implement check-tier.ts**~~ - Done in Phase 5 with Stripe integration (2026-02-07)
- [ ] **Link search results to content detail page** - Add `/content/[id]` links from search result items
- [ ] **Per-IP submission tracking** - Submission guard uses global Content table counts; a dedicated SubmissionLog table would enable true per-IP anonymous rate limiting
- [ ] **Blocklist cache layer** - `isDomainBlocked()` queries DB on every call; add in-memory cache with TTL to reduce DB load
- [ ] **Admin blocklist UI** - Build admin panel page for managing blocked domains (currently API-only via curl)
- [ ] **URL shortener resolution for verify endpoint** - Currently only submit endpoint resolves shorteners; verify/url should too
- [x] **Scale user submissions** - Async queue system with SubmissionJob model, worker, polling (2026-02-07)

### Phase 6 Known Gaps & Limitations
- [ ] **Quota race condition** - Concurrent requests can slightly exceed the monthly limit because usage is recorded after processing (fire-and-forget), not atomically with the check. Acceptable for MVP traffic; fix with atomic counter or Redis at scale.
- [ ] **Quota status off-by-one in response headers** - The `X-Quota-Used`/`X-Quota-Remaining` headers reflect the count at check time, not after the current request is recorded. Slightly stale for the in-flight request.
- [ ] **No quota info in 429 JSON body** - When quota is exceeded, the error response includes quota headers but the JSON body only has a generic error message. Could add a `quota` field to the 429 body for easier programmatic handling.
- [ ] **Quota cache** - `getQuotaStatus()` runs a `COUNT(*)` query on every API request. At high volume, add an in-memory or Redis cache with short TTL (e.g. 30s) to reduce DB pressure.
- [ ] **Per-key usage breakdown** - `ApiUsage` records `apiKeyId` but there's no endpoint or dashboard to view per-key breakdowns. Users with multiple keys can't see which key is consuming their quota.

### Phase 9 Known Gaps & Limitations
- [ ] **User tier not looked up from session** - Submit route currently hardcodes `tier: 'free'` when enqueuing. Should look up the authenticated user's tier from NextAuth session for proper priority assignment. PRO/ENTERPRISE users currently get no priority boost.
- [ ] **Cron job not yet configured for submission worker** - The `/api/submit/worker` endpoint exists but no external cron is triggering it. Need to add a second cron job at cron-job.org (like the crawl worker) to call `POST https://www.real.press/api/submit/worker` with `Authorization: Bearer <CRON_SECRET>`. Recommended schedule: every 1 minute during peak, every 5 minutes otherwise.
- [ ] **No content validation in async path** - The sync path runs `validateContent()` post-extraction to reject paywalls/login pages/thin content. The async worker skips this check. Should add content validation to `processSubmissionJob()` before AI detection.
- [ ] **No stale job cleanup** - Jobs stuck in PROCESSING (e.g., worker crashed mid-process) are never reclaimed. Need a cleanup sweep that resets PROCESSING jobs older than 5 minutes back to QUEUED.
- [ ] **No estimated wait time** - Status endpoint returns queue position but not estimated wait time. Could calculate from average processing duration of recent completed jobs.
- [ ] **Sequential job processing in worker** - Worker processes jobs one-at-a-time in a loop (`processNextJob` called sequentially). Could parallelize with `Promise.all` for a concurrency of 2-3 to process faster within the 60s function limit.
- [ ] **No WebSocket/SSE for real-time updates** - Polling every 2 seconds works but adds latency and unnecessary requests. WebSocket or Server-Sent Events would provide instant updates. Acceptable for MVP; consider for post-funding.
- [ ] **Job history cleanup** - Completed/failed jobs accumulate in `submission_jobs` table forever. Need a periodic cleanup to delete old terminal jobs (e.g., older than 7 days).
- [ ] **No admin visibility into submission queue** - Unlike crawl jobs (which have `/api/admin/crawl/jobs`), there's no admin endpoint to view, inspect, or cancel submission jobs.

### Post-Funding Scale
- [ ] Migrate scraper queue from PostgreSQL to Redis/BullMQ
- [ ] Migrate submission queue from PostgreSQL to Redis/BullMQ
- [ ] Deploy dedicated worker on Railway (vs Vercel Cron)
- [ ] Bloom filter for fast URL deduplication
- [ ] OpenTelemetry metrics and Grafana dashboards

### Content Source API Integrations

**Implemented (Free):**
- [x] Hacker News API - `src/lib/sources/hackernews.source.ts` (free, no auth)
- [x] DEV.to API - `src/lib/sources/devto.source.ts` (free, no auth)
- [x] YouTube Data API - `src/lib/sources/youtube.source.ts` (10k units/day free, needs YOUTUBE_API_KEY)
- [x] RSS/Atom feeds - `src/lib/sources/rss.source.ts` (Medium, Substack, blogs)

**TODO: Requires Approval Process (Free but gated):**
- [ ] **Reddit API** - Opaque commercial pricing, pre-approval required for all access
  - Rate: 100 req/min (OAuth), 10 req/min (unauth)
  - Cost: Negotiated (not published)
  - Blocker: Requires pre-approval even for personal projects
- [ ] **Facebook/Instagram Graph API** - Free but complex approval
  - Rate: 200 calls/hour per account
  - Cost: Free after app review
  - Blocker: Strict app review, permission levels
- [ ] **TikTok Research API** - Free but approval-gated
  - Rate: 10 req/sec, 1k req/day
  - Cost: Free after approval
  - Blocker: Rate limits disclosed only after access granted
- [ ] **Pinterest API** - Free but requires demo video
  - Rate: Daily limits (Trial), per-minute (Standard)
  - Cost: Free after approval
  - Blocker: Requires video walkthrough for Standard access

**TODO: Expensive APIs (Post-Funding):**
- [ ] **Twitter/X API** - Prohibitively expensive
  - Free tier: 1 req/24hr, 500 posts/month
  - Basic: $200/month
  - Pro: $5,000/month
  - Note: Pay-per-use model in closed beta (Dec 2025)
- [ ] **LinkedIn API** - Enterprise pricing
  - Free tier: Only Sign In + basic profile
  - Cost: $1,000s-$10,000s/month for comprehensive access
  - Note: Not viable for startups
- [ ] **NewsAPI.org** - Too expensive for production
  - Free tier: 100 req/day, dev-only (blocked in production)
  - Cost: $449/month (small), $1,749+/month (enterprise)
  - Alternative: newsdata.io has better free tier
