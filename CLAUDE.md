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

# Prisma commands (after setup)
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
- **Database**: PostgreSQL via Neon (Prisma ORM)
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
│       └── analyze/route.ts  # AI detection endpoint
├── components/
│   ├── SearchBar.tsx
│   ├── SearchResults.tsx
│   ├── AIScoreBadge.tsx      # Color-coded AI score indicator
│   ├── SubmitForm.tsx
│   └── FilterPanel.tsx
└── lib/
    ├── db/prisma.ts          # Prisma client singleton
    ├── services/
    │   ├── content.service.ts
    │   ├── extraction.service.ts
    │   └── ai-detection.service.ts
    └── ai-detection/
        ├── index.ts          # Detection orchestrator
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

## Environment Variables

```bash
DATABASE_URL="postgresql://..."     # Neon connection string
GPTZERO_API_KEY="..."               # GPTZero API key
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Development Plan

Full plan: `~/.claude/plans/optimized-honking-donut.md`

**Sprint 1:** Database + URL submission
**Sprint 2:** AI detection integration
**Sprint 3:** Search with AI badges
**Sprint 4:** Polish + demo ready
