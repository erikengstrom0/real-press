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
- Prisma 7 requires `accelerateUrl` in client config (not `datasourceUrl`)

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
| Sprint 2 | AI detection integration | Pending |
| Sprint 3 | Search with AI badges | Pending |
| Sprint 4 | Polish + demo ready | Pending |

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

### Future Decisions

*(Add decisions here as they are made in future sprints)*
