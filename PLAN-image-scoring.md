# Image Scoring Fix — Development Plan

## Problem Statement

All 271 entries in the database have `image_score = null`, `image_confidence = null`,
`analyzed_types = []`, and `fusion_details.method = "text_only"`. The multi-modal scoring
pipeline is fully implemented but images never enter it because `extractMedia` defaults
to `false` at every entry point.

## Root Causes

1. **`extractMedia` defaults to `false`** — Users/scrapers must explicitly opt-in
2. **ML service failures are silent** — `analyzeImages()` returns `null` without error
3. **`extractContent()` is text-only** — Media extraction is a separate, opt-in step

## Architecture (Current)

```
URL Submission
  → extractContent(url)           ← TEXT ONLY
  → if extractMedia:
      extractMediaFromUrl(url)    ← IMAGES EXTRACTED (but never called)
  → if hasMedia:
      analyzeMultiModalAndStore() ← FULL PIPELINE (never reached)
    else:
      analyzeAndStoreScore()      ← TEXT-ONLY PATH (always used)
```

## Architecture (Target)

```
URL Submission
  → extractContent(url)           ← TEXT
  → extractMediaFromUrl(url)      ← IMAGES (always)
  → analyzeMultiModalAndStore()   ← FULL PIPELINE (always)
      → detectAIContent(text)     ← Text scoring (heuristic + HuggingFace)
      → analyzeImages(images)     ← Image scoring (ML service CNN)
      → calculateMultiModalComposite() ← Fusion
```

---

## Development Tasks

### Phase 1: Enable Image Extraction by Default

#### Task 1.1: Change `extractMedia` default to `true`
**Files:**
- `src/app/api/submit/route.ts` line 33
  - Change: `extractMedia: z.boolean().optional().default(false)` → `.default(true)`
- `src/app/api/v1/verify/url/route.ts` line 25
  - Same change
- `src/lib/services/submission-queue.service.ts` line 59
  - Ensure async worker respects the new default

**Risk:** Slightly slower submissions (extra HTTP fetch for media extraction).
**Mitigation:** Media extraction is already implemented and tested; the extra fetch
adds ~1-3s per submission.

#### Task 1.2: Integrate media extraction into `extractContent()`
**Files:**
- `src/lib/services/extraction.service.ts`
  - Extend `ExtractedContent` interface to include `images: string[]` and `videoUrl?: string`
  - Call `extractMediaFromUrl()` within `extractContent()` so media is always available
  - Return extracted image URLs alongside text content

**Alternative approach:** Keep `extractContent()` text-only but always call
`extractMediaFromUrl()` at the submission layer. This is simpler and avoids
changing the extraction service contract.

**Recommendation:** Alternative approach — less code change, fewer side effects.

---

### Phase 2: Verify ML Service Connectivity

#### Task 2.1: Verify ML service is running and accessible
**Actions:**
- Hit `https://ml.real.press/health` to check service status
- Verify `ML_SERVICE_URL` is set in production environment (Vercel/Railway)
- Verify `PROVIDER_IMAGE_ENABLED` is not set to `'false'`
- Test image detection endpoint: `POST https://ml.real.press/api/detect/image`

#### Task 2.2: Add ML service health logging
**Files:**
- `src/lib/ai-detection/index.ts` lines 228-282 (`analyzeImages()`)
  - When `localImageProvider.isAvailable()` returns false, log the specific reason
  - Include `ML_SERVICE_URL` value and `PROVIDER_IMAGE_ENABLED` value in log
- `src/lib/ai-detection/providers/image-local.provider.ts`
  - Add startup health check that logs ML service connectivity on first use
  - Include response time in health check logs

---

### Phase 3: Fix Silent Failures

#### Task 3.1: Surface image scoring failures in the database
**Files:**
- `src/lib/services/ai-detection.service.ts` (`analyzeMultiModalAndStore()`)
  - When images are provided but `imageScore` comes back null, store diagnostic info
  - Set `analyzedTypes` to `['text']` (not empty) to indicate text was analyzed
  - Add `imageSkippedReason` field to `providerDetails` JSONB

#### Task 3.2: Add image scoring status to API responses
**Files:**
- `src/app/api/submit/route.ts`
  - Include `mediaAnalyzed: boolean` and `imageCount: number` in response
  - If images were found but not scored, include reason

---

### Phase 4: Route All Submissions Through Multi-Modal Path

#### Task 4.1: Always use `analyzeMultiModalAndStore()`
**Files:**
- `src/app/api/submit/route.ts` lines 267-310 (sync path)
  - Remove the `if (hasMedia)` branch
  - Always call `analyzeMultiModalAndStore()` with whatever media was found
  - `detectMultiModalContent()` already handles text-only gracefully
- `src/lib/services/submission-queue.service.ts` lines 257-267 (async path)
  - Same change for the async worker

**Rationale:** `detectMultiModalContent()` already handles all combinations:
- Text only → returns text score
- Text + images → returns fused score
- Text + images + video → returns fused score
No need for a separate text-only code path.

#### Task 4.2: Ensure `analyzeMultiModalAndStore()` handles empty images gracefully
**Files:**
- `src/lib/services/ai-detection.service.ts`
  - Verify that passing `images: []` doesn't cause errors
  - Verify that `ContentMedia` records are only created when images exist
  - Verify that `analyzedTypes` correctly reflects what was actually analyzed

---

### Phase 5: Backfill Existing Entries

#### Task 5.1: Create backfill script for existing content
**New file:** `scripts/backfill-image-scores.ts`
- Query all Content records that have `AiScore.analyzedTypes` not containing 'image'
- For each, re-run `extractMediaFromUrl(content.url)` to get images
- Run `analyzeMultiModalAndStore()` to re-score with images
- Update existing `AiScore` record (upsert)
- Rate-limit ML service calls (e.g., 2/second)
- Support `--dry-run` flag to preview what would be re-scored
- Support `--limit N` flag to process N entries at a time
- Log progress and errors

#### Task 5.2: Create admin endpoint for manual re-scoring
**New file:** `src/app/api/admin/rescore/route.ts`
- POST endpoint to re-score a specific content ID with full multi-modal analysis
- Requires admin authentication (`ADMIN_SECRET`)
- Returns old vs new score comparison

---

### Phase 6: Testing & Validation

#### Task 6.1: Test image detection end-to-end
- Submit a URL with known AI-generated images
- Submit a URL with known human photographs
- Verify `image_score`, `image_confidence`, and `analyzed_types` are populated
- Verify `ContentMedia` and `MediaScore` records are created
- Verify composite score reflects image analysis

#### Task 6.2: Test edge cases
- URL with no images → should score text only, `analyzed_types: ['text']`
- URL with broken image links → should skip failed images, score remaining
- URL with very large images (>10MB) → ML service should reject gracefully
- URL behind paywall/login → extraction should fail gracefully

---

## File Summary

| File | Changes |
|------|---------|
| `src/app/api/submit/route.ts` | Default `extractMedia` to true, always use multi-modal path |
| `src/app/api/v1/verify/url/route.ts` | Default `extractMedia` to true |
| `src/lib/services/submission-queue.service.ts` | Match new default, always use multi-modal path |
| `src/lib/ai-detection/index.ts` | Better logging for image analysis failures |
| `src/lib/ai-detection/providers/image-local.provider.ts` | Startup health check logging |
| `src/lib/services/ai-detection.service.ts` | Handle empty images, store skip reasons |
| `scripts/backfill-image-scores.ts` | New: backfill existing entries |
| `src/app/api/admin/rescore/route.ts` | New: manual re-score endpoint |

## Priority Order

1. **Phase 2** — Verify ML service is running (5 min, diagnostic only)
2. **Phase 1** — Enable image extraction (small code change, big impact)
3. **Phase 4** — Route through multi-modal path (removes dead code path)
4. **Phase 3** — Fix silent failures (observability)
5. **Phase 5** — Backfill existing entries (data quality)
6. **Phase 6** — Testing & validation (confidence)
