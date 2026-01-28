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
┌────────────────────────────────────────────────┐
│                   FRONTEND                      │
│  Home (/) │ Search (/search) │ Submit (/submit)│
│  Components: SearchBar, SearchResults, AIBadge │
└────────────────────────────────────────────────┘
                       │
┌────────────────────────────────────────────────┐
│                   API ROUTES                    │
│  /api/search │ /api/submit │ /api/analyze      │
└────────────────────────────────────────────────┘
                       │
┌────────────────────────────────────────────────┐
│                   SERVICES                      │
│  PostgreSQL (Neon) │ GPTZero API │ Heuristics  │
└────────────────────────────────────────────────┘
```

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict mode
- **Database**: PostgreSQL via Neon (Prisma 7 ORM)
- **AI Detection**: GPTZero API + custom heuristics
- **Styling**: CSS Modules
- **Hosting**: Vercel

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
    │   └── ai-detection.service.ts (Sprint 2)
    └── ai-detection/         # Sprint 2
        ├── index.ts
        ├── composite-score.ts
        └── providers/
            ├── gptzero.provider.ts
            └── heuristic.provider.ts
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
DATABASE_URL="postgresql://..."     # Neon connection string (prisma+postgres:// format)
GPTZERO_API_KEY="..."               # GPTZero API key (Sprint 2)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Development Plan

Full plan: `DEVELOPMENT_PLAN.md`

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 1 | Database + URL submission | ✅ Complete |
| Sprint 2 | AI detection integration | ✅ Complete |
| Sprint 3 | Search with AI badges | Pending |
| Sprint 4 | Polish + demo ready | Pending |

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

### Future Decisions

*(Add decisions here as they are made in future sprints)*
