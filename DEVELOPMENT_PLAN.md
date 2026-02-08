# Real Press - Development Plan

## Goal

Build a **fundable demo** of a search engine that surfaces human-generated content with AI detection scores. Designed for one developer with AI coding assistance.

---

## What Makes This Fundable

1. **Clear Problem:** AI-generated content is flooding the internet; users can't trust search results
2. **Unique Solution:** Every search result shows an AI detection score (Human → AI spectrum)
3. **Demonstrable:** Working search + visible AI scores = compelling demo
4. **Scalable Story:** Start with submissions → curated crawl → full web crawler

---

## MVP Scope

**Core Features Only:**
- Submit URLs → Extract content → Store in database
- Search indexed content
- AI detection score on every result (GPTZero + heuristics)
- Visual AI score badges (green = human, red = AI)
- Filter by AI classification

**Defer to Post-Funding:**
- User accounts & authentication
- Background job queues
- Web crawling
- Email alerts
- Advanced analytics

---

## Tech Stack (All Free Tier)

| Component | Service | Cost |
|-----------|---------|------|
| Framework | Next.js 14 + TypeScript | Free |
| Database | Neon PostgreSQL | Free (0.5GB) |
| ORM | Prisma 7 | Free |
| AI Detection | GPTZero API | ~$10/mo for demo |
| Hosting | Vercel | Free |

**Total MVP Cost: ~$10/month**

---

## Sprint 1: Database & Submission ✅ COMPLETE

### Goal
Users can submit URLs, content is extracted and stored.

### Completed Tasks
- [x] Set up Prisma with Neon PostgreSQL configuration
- [x] Create Prisma schema (Content, AiScore models)
- [x] Build `/submit` page with URL input form
- [x] Create `/api/submit` endpoint
- [x] Implement content extraction (title, description, text)
- [x] Store content in database
- [x] Basic validation (valid URL, no duplicates)

### Files Created
```
prisma/schema.prisma
src/lib/db/prisma.ts
src/lib/services/content.service.ts
src/lib/services/extraction.service.ts
src/app/submit/page.tsx
src/app/api/submit/route.ts
src/components/SubmitForm.tsx
src/components/SubmitForm.module.css
```

### Remaining Setup
- [ ] Configure Neon database connection (run `npx neonctl init` or set DATABASE_URL manually)
- [ ] Push schema to database (`npx prisma db push`)

---

## Sprint 2: AI Detection ✅ COMPLETE

### Goal
Every piece of content gets an AI detection score.

### Completed Tasks
- [x] GPTZero API integration
- [x] Heuristic detection (vocabulary diversity, sentence variation)
- [x] Composite score calculation (weighted average)
- [x] Score classification (Human → AI spectrum)
- [x] Run detection after content submission
- [x] Store scores in database

### AI Score Classification

| Score | Classification | Meaning |
|-------|----------------|---------|
| 0.00-0.15 | `human` | Definitely human-written |
| 0.15-0.35 | `likely_human` | Probably human-written |
| 0.35-0.65 | `unsure` | Can't determine |
| 0.65-0.85 | `likely_ai` | Probably AI-generated |
| 0.85-1.00 | `ai` | Definitely AI-generated |

### Composite Score Algorithm

```typescript
function calculateCompositeScore(
  gptzeroScore: number | null,
  heuristicScore: number
): { score: number; classification: string } {
  const gptzeroWeight = 0.7;
  const heuristicWeight = 0.3;

  let score: number;
  if (gptzeroScore !== null) {
    score = (gptzeroScore * gptzeroWeight) + (heuristicScore * heuristicWeight);
  } else {
    score = heuristicScore;
  }

  if (score < 0.15) return { score, classification: 'human' };
  if (score < 0.35) return { score, classification: 'likely_human' };
  if (score < 0.65) return { score, classification: 'unsure' };
  if (score < 0.85) return { score, classification: 'likely_ai' };
  return { score, classification: 'ai' };
}
```

### New Files to Create
```
src/lib/ai-detection/index.ts
src/lib/ai-detection/types.ts
src/lib/ai-detection/composite-score.ts
src/lib/ai-detection/providers/gptzero.provider.ts
src/lib/ai-detection/providers/heuristic.provider.ts
src/lib/services/ai-detection.service.ts
```

---

## Sprint 3: Search & Display ✅ COMPLETE

### Goal
Working search with AI score badges on results.

### Completed Tasks
- [x] Connect `/api/search` to PostgreSQL (full-text search)
- [x] Create AIScoreBadge component (color-coded)
- [x] Update SearchResults to show AI badges
- [x] Add classification filter to search (iOS-style toggles)
- [x] Sort by Human Score option
- [x] Basic pagination
- [x] Inverted score display (100% = human)

### AIScoreBadge Colors

```typescript
const classificationConfig = {
  human: { label: 'Human', color: '#22c55e', bgColor: '#dcfce7' },
  likely_human: { label: 'Likely Human', color: '#84cc16', bgColor: '#ecfccb' },
  unsure: { label: 'Unsure', color: '#eab308', bgColor: '#fef9c3' },
  likely_ai: { label: 'Likely AI', color: '#f97316', bgColor: '#ffedd5' },
  ai: { label: 'AI Generated', color: '#ef4444', bgColor: '#fee2e2' },
};
```

### New Files to Create
```
src/components/AIScoreBadge.tsx
src/components/AIScoreBadge.module.css
src/components/FilterPanel.tsx
```

---

## Sprint 4: Polish & Demo-Ready ✅ COMPLETE

### Goal
Clean, presentable demo for investor meetings.

### Completed Tasks
- [x] Landing page with Real Press branding and value proposition
- [x] Loading states (LoadingSpinner component)
- [x] Error handling (ErrorMessage component with retry)
- [x] Mobile responsive design (768px, 480px breakpoints)
- [x] Filter toggles update without page refresh
- [x] Duplicate URL feedback shows existing analysis
- [x] CSS modules for consistent styling

### Deferred to Post-MVP
- [ ] Pre-seed database with 50-100 curated URLs
- [ ] Basic analytics (search count, submissions)
- [ ] GPTZero API key setup (currently using heuristic-only detection)

### Landing Page Copy
- **Logo:** "Real Press"
- **Headline:** "A Search Engine for the Human Web"
- **Subheadline:** "In an age of AI-generated content, finding authentic human writing is harder than ever..."
- **CTA:** Search bar + "Submit a URL to analyze" link

---

## Sprint 5: Vercel Deployment & Design System 🚀 IN PROGRESS

### Goal
Deploy the MVP to production for investor demos with polished visual design.

### Completed Tasks
- [x] Create vercel.json configuration
- [x] Create .env.example for documentation
- [x] Update app URL to real.press domain
- [x] Add multi-modal AI detection (image/video support)
- [x] Implement 1920s-30s retro newspaper design system
- [x] Create rubber stamp AI score badges with random variations
- [x] Update all components to use design system CSS variables
- [x] Create `/styleguide` style guide page
- [x] Remove paper texture (too noisy)
- [x] Update toggle switches to match retro aesthetic

### Remaining Tasks
- [ ] Deploy to Vercel
- [ ] Configure environment variables in Vercel dashboard
- [ ] Test production deployment
- [ ] Configure custom domain (real.press)

### Environment Variables Required
```
DATABASE_URL         - Neon PostgreSQL connection string
GPTZERO_API_KEY      - GPTZero API key for AI detection
NEXT_PUBLIC_APP_URL  - Production URL (e.g., https://realpress.app)
```

### Deployment Steps
1. Run `vercel` to link project and deploy preview
2. Add environment variables in Vercel dashboard
3. Run `vercel --prod` to deploy to production
4. Configure custom domain in Vercel settings

---

## Post-MVP Roadmap (After Funding)

### Phase 2: Scale & Users
- User accounts (NextAuth.js)
- Search history & bookmarks
- Meilisearch for faster full-text search
- Background job processing (Inngest)

### Phase 3: Crawling
- Curated source crawler
- robots.txt respect
- Scheduled re-crawling
- URL discovery

### Phase 4: Monetization
- Pro tier with higher limits
- API access for developers
- Enterprise features

---

## Investor Demo Script

1. **Open landing page** - "This is Real Press, a search engine for the human web"
2. **Show search** - "Let me search for 'how to learn Python'"
3. **Point to badges** - "See these colored badges? Green means human-written, red means AI-generated"
4. **Filter results** - "I can filter to show only human content"
5. **Submit URL** - "Users can submit any URL to be analyzed"
6. **Show score** - "Within seconds, we detect if it's human or AI"
7. **The pitch** - "As AI floods the internet, Real Press helps users find authentic content"

---

## Known Gaps & Limitations

Track items that need attention but aren't blocking the demo:

| Gap | Impact | Priority | Notes |
|-----|--------|----------|-------|
| GPTZero API key not configured | AI detection uses heuristics only (less accurate) | Medium | Get key from gptzero.me, add to Vercel env vars |
| ML Service not deployed | Image/video detection unavailable | Low | Text detection works fine for MVP |
| No custom domain | Using Vercel default domain | Low | Configure after deployment works |

---

## Verification Checklist

Before demo:
- [x] Submit 10+ URLs with varied AI scores (seeded via Neon MCP)
- [x] Search works and shows results with badges
- [x] Filter by classification works (Human Only toggle)
- [x] Sort by score works (Sort by Score toggle)
- [x] Mobile responsive (tested at 768px, 480px)
- [x] No console errors
- [ ] Page loads in under 2 seconds
- [ ] Custom domain configured
