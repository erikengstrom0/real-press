# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real Press is a search engine web application built with Next.js 14 and TypeScript.

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
```

## Architecture

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: CSS (inline styles currently, can be migrated to CSS modules or Tailwind)

### Directory Structure

```
src/
├── app/           # Next.js App Router pages and layouts
│   ├── search/    # Search results page
│   ├── layout.tsx # Root layout
│   └── page.tsx   # Home page
├── components/    # Reusable React components
└── lib/           # Utility functions and shared logic
```

### Key Patterns

- Use the `@/*` path alias to import from `src/` (e.g., `import { SearchBar } from "@/components/SearchBar"`)
- Client components must have `"use client"` directive at the top
- Search queries are passed via URL search params (`/search?q=query`)
