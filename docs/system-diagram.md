# Real Press - System Architecture Diagram

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Service Architecture](#2-service-architecture)
3. [Database Schema (Source of Record)](#3-database-schema-source-of-record)
4. [API Routes & Endpoints](#4-api-routes--endpoints)
5. [AI Detection Pipeline](#5-ai-detection-pipeline)
6. [ML Service (Python/FastAPI)](#6-ml-service-pythonfastapi)
7. [Content Extraction & Analysis Pipeline](#7-content-extraction--analysis-pipeline)
8. [Web Scraper / Background Crawler](#8-web-scraper--background-crawler)
9. [Frontend Data Fetching](#9-frontend-data-fetching)
10. [Authentication & Security](#10-authentication--security)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Environment Variables](#12-environment-variables)
13. [Data Flow Diagrams](#13-data-flow-diagrams)
14. [Key File Reference](#14-key-file-reference)

---

## 1. System Overview

Real Press is a multi-service web application that detects AI-generated content (text, images, video) in online articles. It consists of three independently deployed services communicating over HTTPS, backed by a shared serverless PostgreSQL database.

```
                        ┌─────────────────────────────────────────────────────┐
                        │                    INTERNET                         │
                        └──────────────┬──────────────────┬───────────────────┘
                                       │                  │
                   ┌───────────────────▼──┐       ┌───────▼────────────────┐
                   │   User Browser       │       │  External Cron         │
                   │                      │       │  (cron-job.org)        │
                   │  - Search articles   │       │  - Every 5 minutes     │
                   │  - Submit URLs       │       │  - Triggers scraper    │
                   │  - View results      │       │                        │
                   └───────────┬──────────┘       └───────┬────────────────┘
                               │                          │
                               │  HTTPS                   │  HTTPS + CRON_SECRET
                               │                          │
          ┌────────────────────▼──────────────────────────▼─────────────────────┐
          │                                                                     │
          │              NEXT.JS APPLICATION (Vercel)                           │
          │              https://real.press                                     │
          │                                                                     │
          │   ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐      │
          │   │  Frontend    │  │  API Routes   │  │  Background Jobs    │      │
          │   │  (React/SSR) │  │  /api/*       │  │  /api/admin/crawl/* │      │
          │   └──────────────┘  └──────┬───────┘  └──────────┬──────────┘      │
          │                            │                     │                  │
          └────────────────────────────┼─────────────────────┼──────────────────┘
                                       │                     │
                    ┌──────────────────┼─────────────────────┼──────────┐
                    │                  │                     │          │
          ┌─────────▼──────┐  ┌────────▼───────┐  ┌─────────▼──────┐   │
          │  Neon           │  │  ML Service    │  │  HuggingFace   │   │
          │  PostgreSQL     │  │  (Railway)     │  │  Inference API │   │
          │                 │  │  ml.real.press  │  │                │   │
          │  Source of      │  │                │  │  Text AI       │   │
          │  Record for     │  │  Image & Video │  │  Detection     │   │
          │  all data       │  │  AI Detection  │  │  (RoBERTa)     │   │
          └────────────────┘  └────────────────┘  └────────────────┘   │
                                                                       │
                                                           ┌───────────▼────┐
                                                           │  GPTZero API   │
                                                           │  (Optional)    │
                                                           │  Paid backup   │
                                                           └────────────────┘
```

---

## 2. Service Architecture

### Services & Their Responsibilities

| Service | Host | Platform | Role |
|---------|------|----------|------|
| **Next.js App** | `https://real.press` | Vercel | Frontend + API + Job orchestration |
| **ML Service** | `https://ml.real.press` | Railway (Docker) | Image/video AI detection (CNN model) |
| **PostgreSQL** | Neon serverless | Neon | Source of record for all persistent data |
| **HuggingFace API** | `router.huggingface.co` | External | Primary text AI detection (RoBERTa) |
| **GPTZero API** | `api.gptzero.me` | External | Secondary text AI detection (optional/paid) |
| **Cron Service** | `cron-job.org` | External | Triggers background scraper every 5 min |
| **Cloudflare** | - | External | DNS management (CNAME for ml.real.press) |

### Service-to-Service Communication

```
Next.js App ──Prisma/TCP──────────────► Neon PostgreSQL
Next.js App ──HTTPS POST───────────────► ML Service (Railway)
Next.js App ──HTTPS POST───────────────► HuggingFace Inference API
Next.js App ──HTTPS POST───────────────► GPTZero API (optional)
Cron Service ──HTTPS POST + header──────► Next.js App (/api/admin/crawl/worker)
User Browser ──HTTPS GET/POST───────────► Next.js App
ML Service  ──HTTPS GET─────────────────► External URLs (download images/video)
Next.js App ──HTTPS GET─────────────────► External URLs (scrape articles)
```

---

## 3. Database Schema (Source of Record)

All persistent data lives in **Neon PostgreSQL**, accessed via **Prisma ORM** from the Next.js app. The ML service does NOT directly access the database.

### Entity Relationship Diagram

```
┌──────────────────────┐       ┌──────────────────────┐
│       Content         │       │       AiScore         │
├──────────────────────┤       ├──────────────────────┤
│ id (PK, UUID)         │──1:1──│ id (PK, UUID)         │
│ url (unique)          │       │ contentId (FK, unique) │
│ domain                │       │ compositeScore (0-1)   │
│ title                 │       │ classification         │
│ description           │       │   (human|likely_human| │
│ contentText           │       │    unsure|likely_ai|ai)│
│ contentHash (SHA-256) │       │ gptzeroScore           │
│ status                │       │ heuristicScore         │
│   (pending|analyzed|  │       │ textScore              │
│    failed)            │       │ imageScore             │
│ publishedAt           │       │ videoScore             │
│ author                │       │ textConfidence         │
│ language              │       │ imageConfidence        │
│ wordCount             │       │ videoConfidence        │
│ sentenceCount         │       │ analyzedTypes          │
│ readingLevel          │       │ createdAt              │
│ vocabularyDiversity   │       └──────────────────────┘
│ sentimentScore        │
│ avgSentenceLength     │       ┌──────────────────────┐
│ sentenceLengthVariance│       │    ContentMedia       │
│ punctuationDiversity  │       ├──────────────────────┤
│ repetitionScore       │──1:N──│ id (PK, UUID)         │
│ namedEntityDensity    │       │ contentId (FK)         │
│ temporalRefDensity    │       │ type (image|video)     │
│ linkCount             │       │ url                    │
│ externalLinkCount     │       │ alt                    │
│ imageCount            │       │ width, height          │
│ hasVideo              │       │ fileSize               │
│ canonicalUrl          │──────►│                        │
│ siteName              │       └───────────┬───────────┘
│ ogType                │                   │ 1:1
│ schemaType            │       ┌───────────▼───────────┐
│ authorId (FK)         │       │     MediaScore        │
│ createdAt             │       ├──────────────────────┤
│ updatedAt             │       │ id (PK, UUID)         │
└──────┬───────────────┘       │ mediaId (FK, unique)   │
       │                        │ score (0-1)            │
       │ N:1                    │ confidence             │
┌──────▼───────────────┐       │ provider               │
│       Author          │       │ modelVersion           │
├──────────────────────┤       └──────────────────────┘
│ id (PK, UUID)         │
│ name                  │
│ normalizedName (uniq) │
│ domain                │
│ articleCount          │       ┌──────────────────────┐
│ avgScore              │       │       Topic           │
│ createdAt             │       ├──────────────────────┤
│ updatedAt             │       │ id (PK, UUID)         │
└──────────────────────┘       │ name (unique)         │
                                │ slug (unique)         │
       Content ──N:M──          │ articleCount          │
┌──────────────────────┐       │ avgScore              │
│    ContentTopic       │       └──────────┬───────────┘
├──────────────────────┤                   │
│ id (PK, UUID)         │───────────────────┘
│ contentId (FK)        │
│ topicId (FK)          │
│ relevance (Float)     │
└──────────────────────┘

┌──────────────────────┐       ┌──────────────────────┐
│      CrawlJob         │       │    CrawlDomain       │
├──────────────────────┤       ├──────────────────────┤
│ id (PK, UUID)         │       │ id (PK, UUID)         │
│ url                   │       │ domain (unique)        │
│ domain                │       │ crawlDelayMs           │
│ priority (Int)        │       │ maxConcurrent          │
│ status                │       │ requestsInWindow       │
│   (PENDING|PROCESSING │       │ robotsTxt (cached)     │
│    |COMPLETED|FAILED  │       │ robotsTxtExpiry        │
│    |DEAD_LETTER)      │       │ lastRequestAt          │
│ attempts (Int)        │       │ discoverySources       │
│ maxAttempts (3)       │       └──────────────────────┘
│ lastError             │
│ scheduledFor          │       ┌──────────────────────┐
│ startedAt             │       │    CrawlSource        │
│ completedAt           │       ├──────────────────────┤
│ contentId (FK)        │       │ id (PK, UUID)         │
│ createdAt             │       │ url (unique)           │
└──────────────────────┘       │ type (RSS|ATOM|       │
                                │   SITEMAP)             │
┌──────────────────────┐       │ domain                 │
│    CrawlMetric        │       │ isActive               │
├──────────────────────┤       │ checkInterval          │
│ id (PK, UUID)         │       │ lastCheckAt            │
│ hour (DateTime, uniq) │       │ nextCheckAt            │
│ jobsCreated           │       │ lastContentCount       │
│ jobsCompleted         │       └──────────────────────┘
│ jobsFailed            │
│ avgProcessingTime     │       ┌──────────────────────┐
│ avgExtractionTime     │       │    DomainStats        │
│ avgAnalysisTime       │       ├──────────────────────┤
└──────────────────────┘       │ id (PK, UUID)         │
                                │ domain                 │
                                │ date                   │
                                │ articleCount           │
                                │ avgScore               │
                                │ humanCount             │
                                │ aiCount                │
                                │  (unique: domain+date) │
                                └──────────────────────┘
```

### Source of Record Summary

| Data | Stored In | Written By | Read By |
|------|-----------|-----------|---------|
| Articles & text content | `Content` table (Neon) | Next.js API (submit + scraper) | Next.js API (search, admin) |
| AI detection scores | `AiScore` table (Neon) | Next.js API (after provider calls) | Next.js API (search results) |
| Media (images/video) metadata | `ContentMedia` table (Neon) | Next.js API (extraction) | Next.js API |
| Media AI scores | `MediaScore` table (Neon) | Next.js API (after ML service call) | Next.js API |
| Authors | `Author` table (Neon) | Next.js API (metadata extraction) | Next.js API |
| Topics | `Topic` table (Neon) | Pre-seeded (16 topics) | Next.js API |
| Article-topic mappings | `ContentTopic` table (Neon) | Next.js API (topic extraction) | Next.js API |
| Crawl job queue | `CrawlJob` table (Neon) | Next.js Admin API / seeds import | Crawl worker |
| Domain rate limits | `CrawlDomain` table (Neon) | Crawl worker | Crawl worker |
| RSS/Sitemap sources | `CrawlSource` table (Neon) | Admin API | Crawl worker |
| Crawl metrics | `CrawlMetric` table (Neon) | Crawl worker | Admin dashboard |
| Domain daily stats | `DomainStats` table (Neon) | Crawl worker | Admin/analytics |
| CNN model weights | Filesystem (Railway container) | Bundled in Docker image | ML Service |

---

## 4. API Routes & Endpoints

### Public Endpoints (Next.js - real.press)

#### `POST /api/submit` - Submit URL for Analysis

```
User Browser
    │
    │  POST /api/submit
    │  Body: { url: "https://example.com/article" }
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Validate & normalize URL                               │
│  Check for duplicate (Content.contentHash) → 409        │
│  Extract content (article-extractor library)            │
│  Create Content record (status: pending)                │
│  [Optional] Extract images/video from HTML              │
│                                                         │
│  ┌─ AI Detection ─────────────────────────────────┐     │
│  │  Text:  HuggingFace + Heuristics → text score  │     │
│  │  Image: ML Service CNN → per-image scores      │     │
│  │  Video: ML Service frames → per-frame scores   │     │
│  │  Composite: weighted average of all modalities  │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  Create AiScore record                                  │
│  Update Content status → analyzed                       │
│  Return: { content, aiScore }                           │
└─────────────────────────────────────────────────────────┘
```

#### `GET /api/search` - Search Indexed Content

```
Query params:
  q       = search term (searches: title, description, contentText, url)
  filter  = human | ai (optional classification filter)
  sort    = score | createdAt
  page    = page number (10 results per page)

Returns: { results: Content[], total, page, totalPages }
```

#### `POST /api/analyze` - Preview AI Detection (No Storage)

```
Body options:
  { text: "..." }                          → text-only analysis
  { text?, images?: string[], videoUrl? }  → multi-modal analysis
  { contentId: "..." }                     → re-analyze existing content

Returns: { score, classification, details }
```

### Admin Endpoints (Protected)

#### `POST /api/admin/crawl/worker` - Process Job Queue

```
Headers: Authorization: Bearer <ADMIN_SECRET>  OR  x-cron-secret: <CRON_SECRET>
Body: { batchSize?: 5, maxConcurrent?: 3 }
Max Duration: 60 seconds (Vercel limit)
Returns: { processed, succeeded, failed, rateLimited }
```

#### `GET /api/admin/crawl/jobs` - List Crawl Jobs

```
Query params: stats=true (include aggregate stats)
Returns: { jobs: CrawlJob[], stats? }
```

#### `POST /api/admin/crawl/jobs` - Create Crawl Job

```
Body: { url, priority? }
Returns: { job: CrawlJob }
```

#### `GET /api/admin/crawl/seeds` - List Seed Files

```
Returns: { seeds: [{ name, count, imported }] }
```

#### `POST /api/admin/crawl/seeds` - Import Seed List

```
Query: ?file=tech-essays
Imports URLs from seeds/<file>.json → creates CrawlJobs
Returns: { imported, skipped, total }
```

#### `GET /api/admin/content/[id]` - Full Content Detail

```
Returns: { content, aiScore, media, topics, author }
```

### ML Service Endpoints (FastAPI - ml.real.press)

#### `GET /` - Service Info
#### `GET /health` - Health Check

#### `POST /api/detect/image` - AI Image Detection

```
Body: { image_url: "..." } OR { image_base64: "..." }
Returns: { score: 0-1, confidence: 0-1, model: "cnn_detector" }
Timeout: 30 seconds
Max size: 10MB
```

#### `POST /api/extract-frames` - Video Frame Extraction

```
Body: { video_url: "..." }
Returns: { frames: base64[], fps, duration, total_frames, extracted_count }
Max frames: 20 (evenly spaced)
Timeout: 60 seconds
```

---

## 5. AI Detection Pipeline

### Provider Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ProviderRegistry                              │
│                                                                  │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │                   TEXT PROVIDERS                           │ │
│   │                                                           │ │
│   │   ┌────────────────────┐    ┌─────────────────────┐       │ │
│   │   │  HuggingFace       │    │  GPTZero            │       │ │
│   │   │  (Primary)         │    │  (Paid Backup)      │       │ │
│   │   │                    │    │                     │       │ │
│   │   │  Model: RoBERTa    │    │  Requires:          │       │ │
│   │   │  openai-community/ │    │  GPTZERO_API_KEY    │       │ │
│   │   │  roberta-base-     │    │                     │       │ │
│   │   │  openai-detector   │    │  API: api.gptzero   │       │ │
│   │   │                    │    │  .me/v0/detect      │       │ │
│   │   │  API: router.      │    │                     │       │ │
│   │   │  huggingface.co    │    │  Always available   │       │ │
│   │   │                    │    │  if key is set      │       │ │
│   │   │  Max: 1800 chars   │    │                     │       │ │
│   │   │  Always available  │    │  Higher accuracy    │       │ │
│   │   └────────────────────┘    └─────────────────────┘       │ │
│   │                                                           │ │
│   │   ┌────────────────────┐                                  │ │
│   │   │  Heuristic         │                                  │ │
│   │   │  (Fallback)        │                                  │ │
│   │   │                    │                                  │ │
│   │   │  No API calls      │                                  │ │
│   │   │  Stylometric:      │                                  │ │
│   │   │  - Vocab diversity  │                                  │ │
│   │   │  - Sentence length  │                                  │ │
│   │   │    variation        │                                  │ │
│   │   │  - Punctuation      │                                  │ │
│   │   │  - Repetition       │                                  │ │
│   │   │  - n-gram analysis  │                                  │ │
│   │   │  Requires ≥50 words│                                  │ │
│   │   └────────────────────┘                                  │ │
│   └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │                  IMAGE PROVIDER                           │ │
│   │                                                           │ │
│   │   ┌────────────────────┐                                  │ │
│   │   │  LocalImage        │                                  │ │
│   │   │                    │                                  │ │
│   │   │  Calls ML Service: │                                  │ │
│   │   │  POST ml.real.press│                                  │ │
│   │   │  /api/detect/image │                                  │ │
│   │   │                    │                                  │ │
│   │   │  CNN (ResNet50)    │                                  │ │
│   │   │  Timeout: 30s      │                                  │ │
│   │   │  Max: 10MB         │                                  │ │
│   │   │                    │                                  │ │
│   │   │  Enabled by:       │                                  │ │
│   │   │  PROVIDER_IMAGE_   │                                  │ │
│   │   │  ENABLED=true      │                                  │ │
│   │   └────────────────────┘                                  │ │
│   └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │                  VIDEO PROVIDER                           │ │
│   │                                                           │ │
│   │   ┌────────────────────┐                                  │ │
│   │   │  Video             │                                  │ │
│   │   │                    │                                  │ │
│   │   │  1. Extract frames │                                  │ │
│   │   │     via ML Service │                                  │ │
│   │   │  2. Analyze each   │                                  │ │
│   │   │     frame as image │                                  │ │
│   │   │  3. Aggregate with │                                  │ │
│   │   │     variance adj.  │                                  │ │
│   │   │                    │                                  │ │
│   │   │  Max: 20 frames    │                                  │ │
│   │   │  Enabled by:       │                                  │ │
│   │   │  PROVIDER_VIDEO_   │                                  │ │
│   │   │  ENABLED=true      │                                  │ │
│   │   └────────────────────┘                                  │ │
│   └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Scoring Algorithm

**Text Composite Score** (confidence-weighted):
```
If HuggingFace + Heuristic both available:
  score = (HF_score × 0.7 × HF_conf + Heur_score × 0.3 × Heur_conf)
          / (0.7 × HF_conf + 0.3 × Heur_conf)

If only Heuristic:
  score = Heur_score
```

**Multi-Modal Composite Score**:
```
Base weights:  Text = 50%,  Image = 35%,  Video = 15%

composite = Σ(type_score × type_confidence × base_weight)
            / Σ(type_confidence × base_weight)

Only types that were actually analyzed contribute to the sum.
```

**Classification Thresholds**:
```
Score Range    │ Classification  │ Visual
───────────────┼─────────────────┼────────
0.00 - 0.15   │ human           │ Green
0.15 - 0.35   │ likely_human    │ Light Green
0.35 - 0.65   │ unsure          │ Yellow
0.65 - 0.85   │ likely_ai       │ Orange
0.85 - 1.00   │ ai              │ Red
```

---

## 6. ML Service (Python/FastAPI)

### Architecture

```
┌─────────────────────────────────────────────┐
│           ML Service (Railway)               │
│           https://ml.real.press              │
│                                              │
│   Runtime: Python 3.11 + FastAPI + Uvicorn   │
│   Container: Docker multi-stage build        │
│   Size: ~500MB                               │
│                                              │
│   ┌──────────────────────────────────┐       │
│   │  CNNDetector                     │       │
│   │                                  │       │
│   │  Backbone: ResNet50 (pretrained) │       │
│   │  Head: Linear(2048→1) + Sigmoid  │       │
│   │  Input: 224×224 RGB, ImageNet    │       │
│   │         normalized               │       │
│   │  Output: float 0-1              │       │
│   │    0 = human-created            │       │
│   │    1 = AI-generated             │       │
│   │                                  │       │
│   │  Loaded on startup (30-90s)     │       │
│   │  Device: CPU (configurable)     │       │
│   └──────────────────────────────────┘       │
│                                              │
│   ┌──────────────────────────────────┐       │
│   │  Frame Extractor                 │       │
│   │                                  │       │
│   │  Tool: ffmpeg (static binary)    │       │
│   │  Max frames: 20 (evenly spaced)  │       │
│   │  Output: base64-encoded JPEGs    │       │
│   │  Timeout: 60 seconds             │       │
│   └──────────────────────────────────┘       │
│                                              │
│   Dependencies:                              │
│   - PyTorch 2.2.0 (CPU-only)                │
│   - TorchVision 0.17.0                      │
│   - OpenCV (headless)                        │
│   - Pillow, httpx, aiohttp                   │
│   - ffmpeg static binary (~80MB)             │
│                                              │
│   Health: GET /health (90s startup grace)    │
└─────────────────────────────────────────────┘
```

### Communication with Next.js App

```
Next.js App                              ML Service
    │                                        │
    │  POST /api/detect/image                │
    │  { image_url: "https://..." }          │
    ├───────────────────────────────────────►│
    │                                        │ Download image
    │                                        │ Resize to 224×224
    │                                        │ Normalize (ImageNet)
    │                                        │ Run CNN inference
    │  { score: 0.87, confidence: 0.92,      │
    │    model: "cnn_detector" }             │
    │◄───────────────────────────────────────┤
    │                                        │
    │  POST /api/extract-frames              │
    │  { video_url: "https://..." }          │
    ├───────────────────────────────────────►│
    │                                        │ Download video
    │                                        │ ffmpeg → extract frames
    │  { frames: [base64...],                │
    │    fps: 30, duration: 120,             │
    │    extracted_count: 20 }               │
    │◄───────────────────────────────────────┤
    │                                        │
    │  For each frame:                       │
    │  POST /api/detect/image                │
    │  { image_base64: "..." }               │
    ├───────────────────────────────────────►│
    │  { score, confidence }                 │
    │◄───────────────────────────────────────┤
```

---

## 7. Content Extraction & Analysis Pipeline

### Extraction Flow

```
Input: URL string
    │
    ▼
┌──────────────────────────────────┐
│  URL Validation & Normalization  │
│  - Protocol check (http/https)   │
│  - Domain extraction             │
│  - Query string cleanup          │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Content Extraction              │
│  Library: @extractus/article-    │
│           extractor              │
│                                  │
│  Extracts:                       │
│  - title                         │
│  - description                   │
│  - content (HTML → plain text)   │
│  - author                        │
│  - published date                │
│                                  │
│  Generates:                      │
│  - SHA-256 content hash          │
│    (for deduplication)           │
│                                  │
│  Min: 100 characters             │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Content Analysis                │
│  (Stylometric metrics)           │
│                                  │
│  Calculated:                     │
│  - wordCount                     │
│  - sentenceCount                 │
│  - paragraphCount                │
│  - readingLevel (Flesch-Kincaid) │
│  - vocabularyDiversity (TTR)     │
│  - avgSentenceLength             │
│  - sentenceLengthVariance        │
│  - punctuationDiversity          │
│  - repetitionScore               │
│  - sentimentScore                │
│  - namedEntityDensity            │
│  - temporalReferenceDensity      │
│  - linkCount / externalLinkCount │
│  - imageCount / hasVideo         │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Metadata Extraction             │
│                                  │
│  Sources (priority order):       │
│  1. Open Graph tags              │
│  2. Schema.org JSON-LD           │
│  3. Dublin Core meta tags        │
│  4. HTML <time> elements         │
│  5. Byline regex patterns        │
│                                  │
│  Extracts:                       │
│  - publishedAt                   │
│  - author → Author record        │
│  - canonicalUrl                  │
│  - siteName, ogType, schemaType  │
│  - language                      │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Topic Classification            │
│                                  │
│  Taxonomy: 16 predefined topics  │
│  (technology, AI, startup,       │
│   productivity, science, health, │
│   business, finance, education,  │
│   environment, politics, culture,│
│   sports, entertainment, travel, │
│   food)                          │
│                                  │
│  Method:                         │
│  - Keyword matching (uni/bi/tri) │
│  - TF-IDF-like relevance scoring │
│  - Up to 5 topics per article    │
│  - Stored in ContentTopic with   │
│    relevance weight              │
└──────────────────────────────────┘
```

---

## 8. Web Scraper / Background Crawler

### Job Queue Architecture

```
┌─────────────┐
│  Seed Files  │  (seeds/*.json)
│  tech-essays │
│  news-sites  │
└──────┬──────┘
       │  POST /api/admin/crawl/seeds?file=...
       ▼
┌──────────────────────────────────────────────────┐
│                 CrawlJob Table                    │
│                 (Job Queue in PostgreSQL)         │
│                                                   │
│   PENDING ──► PROCESSING ──► COMPLETED            │
│                    │                              │
│                    └──► FAILED ──► (retry)        │
│                              │                    │
│                              └──► DEAD_LETTER     │
│                                   (max 3 retries) │
└──────────────────────┬───────────────────────────┘
                       │
    Triggered every 5 min by cron-job.org:
    POST /api/admin/crawl/worker
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│              CrawlWorker Service                  │
│                                                   │
│  1. Claim batch (max 5 PENDING jobs)             │
│  2. Process concurrently (max 3 at once)         │
│  3. Per job:                                     │
│     a. Check CrawlDomain rate limit              │
│     b. Respect robots.txt (cached 24h)           │
│     c. Fetch HTML                                │
│     d. Extract content (article-extractor)       │
│     e. Analyze content metrics                   │
│     f. Extract metadata                          │
│     g. Get/create Author record                  │
│     h. Run AI detection (text only for scraper)  │
│     i. Classify topics                           │
│     j. Update DomainStats & Author stats         │
│  4. Mark COMPLETED or FAILED                     │
│  5. Max duration: 60 seconds (Vercel limit)      │
│                                                   │
│  Rate Limiting (per domain):                     │
│  - crawlDelayMs (default: 1000ms between reqs)   │
│  - maxConcurrent (default: 2)                    │
│  - Sliding window tracking                       │
│  - Exponential backoff on failure                │
└──────────────────────────────────────────────────┘
```

### Scraper vs User Submission

| Aspect | User Submission (`/api/submit`) | Web Scraper (crawl worker) |
|--------|-------------------------------|---------------------------|
| Trigger | User clicks submit | External cron (every 5 min) |
| Timing | Synchronous (immediate) | Asynchronous (queued) |
| AI Detection | Text + Image + Video (multi-modal) | Text only |
| Rate Limiting | None (per-request) | Per-domain with robots.txt |
| Retry Logic | None (user gets error) | Up to 3 retries with backoff |
| Input | Single URL from user | Batch from seed lists |
| Response | Immediate result to browser | Stats returned to cron caller |

---

## 9. Frontend Data Fetching

```
┌───────────────────────────────────────────────────────────┐
│                  Next.js Frontend                          │
│                  (React + App Router)                      │
│                                                           │
│  Pages:                                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  / (Landing)                                         │ │
│  │  - Static content + SearchBar component              │ │
│  │  - SearchBar redirects to /search?q=...              │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  /search (Results)                                   │ │
│  │                                                      │ │
│  │  Server-side (initial load):                         │ │
│  │    getSearchResults() → GET /api/search              │ │
│  │    Uses NEXT_PUBLIC_APP_URL for absolute URL          │ │
│  │    Renders SearchResults with initial data            │ │
│  │                                                      │ │
│  │  Client-side (filter/sort changes):                  │ │
│  │    SearchResultsContainer → fetch(/api/search)       │ │
│  │    Updates URL via history.replaceState              │ │
│  │    Re-renders results without full page reload       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  /submit (URL Submission)                            │ │
│  │                                                      │ │
│  │  Client-side:                                        │ │
│  │    SubmitForm → POST /api/submit { url }             │ │
│  │    Shows loading → result/error                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  /admin/login                                        │ │
│  │                                                      │ │
│  │  Client-side:                                        │ │
│  │    Validates token against admin API                  │ │
│  │    Sets admin_token cookie (7-day expiry)            │ │
│  │    Redirects to admin panel                          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  Design System:                                          │
│  - CSS Modules (component-scoped)                        │
│  - Fonts: Caudex (headlines) + Lato (body)              │
│  - Colors: Jungle Green, Celadon, Royal Gold, Paper, Ink │
│  - Aesthetic: 1920s-30s retro newspaper                  │
└───────────────────────────────────────────────────────────┘
```

---

## 10. Authentication & Security

```
┌──────────────────────────────────────────────────────┐
│                 Middleware (src/middleware.ts)          │
│                                                       │
│  Protects:                                           │
│    /admin/*          (pages)                         │
│    /api/admin/*      (API routes)                    │
│                                                       │
│  Auth Methods (checked in order):                    │
│                                                       │
│  1. Authorization: Bearer <ADMIN_SECRET>             │
│     └─ Used by: API clients, scripts                 │
│                                                       │
│  2. Cookie: admin_token=<ADMIN_SECRET>               │
│     └─ Used by: Browser sessions (7-day expiry)      │
│                                                       │
│  3. Query: ?admin_token=<ADMIN_SECRET>               │
│     └─ Used by: Initial login (sets cookie)          │
│                                                       │
│  Special case for crawl worker:                      │
│  4. Header: x-cron-secret: <CRON_SECRET>             │
│     └─ Used by: External cron service                │
│                                                       │
│  On failure: 401 Unauthorized                        │
└──────────────────────────────────────────────────────┘
```

---

## 11. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Cloudflare DNS                              │
│                                                                      │
│   real.press      → CNAME → Vercel                                  │
│   ml.real.press   → CNAME → Railway                                │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────┐
│     Vercel            │  │     Railway           │  │   Neon         │
│                       │  │                       │  │                │
│  Next.js 14           │  │  Docker Container     │  │  Serverless    │
│  App Router           │  │                       │  │  PostgreSQL    │
│  TypeScript           │  │  Python 3.11          │  │                │
│                       │  │  FastAPI + Uvicorn    │  │  Auto-scaling  │
│  Auto-deploy from git │  │                       │  │  Auto-backup   │
│  Edge functions       │  │  PyTorch 2.2 (CPU)    │  │  Branching     │
│  Serverless functions │  │  ffmpeg static         │  │                │
│  60s max duration     │  │  ~500MB image          │  │  Prisma ORM    │
│                       │  │                       │  │  TCP connection│
│  Env vars in Vercel   │  │  Health check:        │  │                │
│  dashboard            │  │  90s startup grace     │  │  Project:      │
│                       │  │  30s interval          │  │  blue-king-    │
│  Custom domain:       │  │                       │  │  05242700      │
│  real.press           │  │  Custom domain:        │  │                │
│                       │  │  ml.real.press         │  │                │
└──────────────────────┘  └──────────────────────┘  └────────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│   cron-job.org        │  │  HuggingFace         │
│                       │  │  Inference API       │
│  Triggers scraper     │  │                      │
│  every 5 minutes      │  │  Free tier           │
│                       │  │  router.huggingface  │
│  POST real.press/     │  │  .co/hf-inference/   │
│  api/admin/crawl/     │  │  models/...          │
│  worker               │  │                      │
│                       │  │  RoBERTa model       │
│  Header:              │  │  openai-community/   │
│  x-cron-secret        │  │  roberta-base-       │
│                       │  │  openai-detector     │
└──────────────────────┘  └──────────────────────┘
```

---

## 12. Environment Variables

### Next.js App (Vercel)

| Variable | Required | Description | Used By |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string | Prisma ORM |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://real.press` | Server-side API calls |
| `ML_SERVICE_URL` | Yes | `https://ml.real.press` | Image/video providers |
| `ADMIN_SECRET` | Yes | Admin authentication token | Middleware |
| `CRON_SECRET` | Yes | External cron authentication | Crawl worker |
| `HUGGINGFACE_API_TOKEN` | No | HF token for higher rate limits | HuggingFace provider |
| `HUGGINGFACE_MODEL` | No | Override default model | HuggingFace provider |
| `GPTZERO_API_KEY` | No | GPTZero paid API key | GPTZero provider |
| `PROVIDER_IMAGE_ENABLED` | No | Enable image detection (`true`) | Image provider |
| `PROVIDER_VIDEO_ENABLED` | No | Enable video detection (`true`) | Video provider |

### ML Service (Railway)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | (Railway injects) | Server port |
| `ML_HOST` | No | `0.0.0.0` | Bind address |
| `ML_PORT` | No | `8000` | Fallback port |
| `ML_DEBUG` | No | `false` | Debug mode |
| `ML_MODEL_NAME` | No | `cnn_detection` | Model name |
| `ML_DEVICE` | No | `cpu` | `cpu` or `cuda` |
| `MAX_IMAGE_SIZE_MB` | No | `10` | Max image upload size |
| `DOWNLOAD_TIMEOUT_SECONDS` | No | `30` | Image download timeout |

---

## 13. Data Flow Diagrams

### Complete User Submission Flow

```
┌────────┐                ┌───────────┐              ┌──────────┐
│ Browser │                │  Vercel   │              │   Neon   │
│         │                │ (Next.js) │              │  (Postgres)│
└────┬────┘                └─────┬─────┘              └─────┬─────┘
     │                           │                          │
     │  POST /api/submit         │                          │
     │  { url: "..." }           │                          │
     ├──────────────────────────►│                          │
     │                           │                          │
     │                           │  SELECT * FROM Content   │
     │                           │  WHERE contentHash = ... │
     │                           ├─────────────────────────►│
     │                           │  (check duplicate)       │
     │                           │◄─────────────────────────┤
     │                           │                          │
     │                           │  Fetch article HTML      │
     │                           ├──────►(target website)   │
     │                           │◄──────                   │
     │                           │                          │
     │                           │  INSERT Content          │
     │                           ├─────────────────────────►│
     │                           │◄─────────────────────────┤
     │                           │                          │
     │                           │                          │
     │                    ┌──────┴──────┐                   │
     │                    │ AI Detection │                   │
     │                    └──────┬──────┘                   │
     │                           │                          │
     │              ┌────────────┼────────────┐             │
     │              │            │            │             │
     │        ┌─────▼─────┐┌────▼────┐┌──────▼──────┐      │
     │        │HuggingFace││Heuristic││  ML Service  │      │
     │        │  (text)    ││ (text)  ││ (img/video)  │      │
     │        └─────┬─────┘└────┬────┘└──────┬──────┘      │
     │              │            │            │             │
     │              └────────────┼────────────┘             │
     │                           │                          │
     │                    ┌──────▼──────┐                   │
     │                    │  Composite   │                   │
     │                    │  Score Calc  │                   │
     │                    └──────┬──────┘                   │
     │                           │                          │
     │                           │  INSERT AiScore          │
     │                           ├─────────────────────────►│
     │                           │                          │
     │                           │  UPDATE Content status   │
     │                           ├─────────────────────────►│
     │                           │                          │
     │  { content, aiScore }     │                          │
     │◄──────────────────────────┤                          │
     │                           │                          │
```

### Complete Scraper Flow

```
┌───────────┐        ┌───────────┐        ┌──────────┐        ┌──────────┐
│ cron-job  │        │  Vercel   │        │   Neon   │        │ Target   │
│ .org      │        │ (Next.js) │        │(Postgres)│        │ Websites │
└─────┬─────┘        └─────┬─────┘        └─────┬────┘        └─────┬────┘
      │                     │                    │                   │
      │ POST /api/admin/    │                    │                   │
      │ crawl/worker        │                    │                   │
      │ (x-cron-secret)     │                    │                   │
      ├────────────────────►│                    │                   │
      │                     │                    │                   │
      │                     │ SELECT CrawlJobs   │                   │
      │                     │ WHERE status=      │                   │
      │                     │ PENDING (limit 5)  │                   │
      │                     ├───────────────────►│                   │
      │                     │◄───────────────────┤                   │
      │                     │                    │                   │
      │                     │ For each job       │                   │
      │                     │ (up to 3 parallel):│                   │
      │                     │                    │                   │
      │                     │ Check CrawlDomain  │                   │
      │                     │ rate limits        │                   │
      │                     ├───────────────────►│                   │
      │                     │◄───────────────────┤                   │
      │                     │                    │                   │
      │                     │ Fetch article      │                   │
      │                     ├───────────────────────────────────────►│
      │                     │◄───────────────────────────────────────┤
      │                     │                    │                   │
      │                     │ Extract + Analyze  │                   │
      │                     │ content locally    │                   │
      │                     │                    │                   │
      │                     │ Call HuggingFace   │                   │
      │                     ├──►(HF API)         │                   │
      │                     │◄──                 │                   │
      │                     │                    │                   │
      │                     │ INSERT Content     │                   │
      │                     │ INSERT AiScore     │                   │
      │                     │ INSERT ContentTopic│                   │
      │                     │ UPDATE Author      │                   │
      │                     │ UPDATE DomainStats │                   │
      │                     │ UPDATE CrawlJob    │                   │
      │                     │  status=COMPLETED  │                   │
      │                     ├───────────────────►│                   │
      │                     │◄───────────────────┤                   │
      │                     │                    │                   │
      │ { processed: 5,     │                    │                   │
      │   succeeded: 4,     │                    │                   │
      │   failed: 1 }       │                    │                   │
      │◄────────────────────┤                    │                   │
```

### Search Flow

```
┌────────┐                ┌───────────┐              ┌──────────┐
│ Browser │                │  Vercel   │              │   Neon   │
│         │                │ (Next.js) │              │ (Postgres)│
└────┬────┘                └─────┬─────┘              └─────┬─────┘
     │                           │                          │
     │  GET /search?q=AI         │                          │
     ├──────────────────────────►│                          │
     │                           │                          │
     │              (Server-Side Rendering)                 │
     │                           │                          │
     │                           │  GET /api/search?q=AI    │
     │                           │  (internal fetch)        │
     │                           │                          │
     │                           │  SELECT Content + AiScore│
     │                           │  WHERE title/desc/text   │
     │                           │  ILIKE '%AI%'            │
     │                           │  ORDER BY createdAt DESC │
     │                           │  LIMIT 10 OFFSET 0      │
     │                           ├─────────────────────────►│
     │                           │◄─────────────────────────┤
     │                           │                          │
     │  <HTML> (SSR results)     │                          │
     │◄──────────────────────────┤                          │
     │                           │                          │
     │  (User toggles filter)    │                          │
     │                           │                          │
     │  GET /api/search?         │                          │
     │  q=AI&filter=human        │                          │
     │  (client-side fetch)      │                          │
     ├──────────────────────────►│                          │
     │                           │  SELECT ... WHERE        │
     │                           │  classification IN       │
     │                           │  ('human','likely_human')│
     │                           ├─────────────────────────►│
     │                           │◄─────────────────────────┤
     │  { results, total, ... }  │                          │
     │◄──────────────────────────┤                          │
     │                           │                          │
     │  (history.replaceState    │                          │
     │   updates URL bar)        │                          │
```

---

## 14. Key File Reference

### Core Services
| File | Purpose |
|------|---------|
| `src/lib/services/ai-detection.service.ts` | Text + multi-modal detection orchestration |
| `src/lib/services/extraction.service.ts` | HTML → content extraction |
| `src/lib/services/crawl-worker.service.ts` | Background job processor |
| `src/lib/services/content-analysis.service.ts` | Stylometric metrics calculation |
| `src/lib/services/metadata-extraction.service.ts` | HTML metadata parsing |
| `src/lib/services/topic-extraction.service.ts` | Keyword → topic classification |

### AI Detection System
| File | Purpose |
|------|---------|
| `src/lib/ai-detection/index.ts` | Multi-modal orchestrator |
| `src/lib/ai-detection/composite-score.ts` | Score aggregation logic |
| `src/lib/ai-detection/providers/huggingface.provider.ts` | Free text detection (RoBERTa) |
| `src/lib/ai-detection/providers/heuristic.provider.ts` | Stylometric fallback |
| `src/lib/ai-detection/providers/image-local.provider.ts` | Image detection via ML service |
| `src/lib/ai-detection/providers/video.provider.ts` | Video frame analysis |

### API Routes
| File | Purpose |
|------|---------|
| `src/app/api/submit/route.ts` | User URL submission |
| `src/app/api/search/route.ts` | Search endpoint |
| `src/app/api/analyze/route.ts` | AI detection preview |
| `src/app/api/admin/crawl/worker/route.ts` | Crawl job processor (cron target) |
| `src/app/api/admin/crawl/jobs/route.ts` | Job queue management |
| `src/app/api/admin/crawl/seeds/route.ts` | Seed list management |
| `src/app/api/admin/content/[id]/route.ts` | Content detail |

### Database & Config
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Complete schema (13 models) |
| `src/lib/db/prisma.ts` | Singleton Prisma client |
| `src/middleware.ts` | Auth middleware for admin routes |
| `next.config.js` | Next.js configuration |
| `vercel.json` | Vercel deployment config |

### ML Service
| File | Purpose |
|------|---------|
| `ml-service/app/main.py` | FastAPI application entry |
| `ml-service/app/models/cnn_detector.py` | ResNet50 CNN model |
| `ml-service/app/routes/detect.py` | Image detection endpoint |
| `ml-service/app/routes/frames.py` | Video frame extraction |
| `ml-service/Dockerfile` | Multi-stage Docker build |
| `ml-service/requirements.txt` | Python dependencies |

### Frontend
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Landing page |
| `src/app/search/page.tsx` | Search results (SSR) |
| `src/app/submit/page.tsx` | URL submission form |
| `src/app/admin/login/page.tsx` | Admin login |
| `src/components/SearchBar.tsx` | Search input |
| `src/components/SearchResults.tsx` | Results display |
| `src/components/AIScoreBadge.tsx` | Score visualization |
