# ⛔ ARCHIVED — DO NOT EXECUTE WITHOUT CHECKING CLAUDE.md FIRST

> **This plan has not been implemented yet, but this file is not the source of truth for project planning.**
> Before acting on anything in this file, you **must** read [`CLAUDE.md`](./CLAUDE.md) for current project state, completed phases, and active TODOs.
> Requirements, priorities, or architecture may have changed since this plan was written. Cross-reference with `CLAUDE.md` before executing any tasks.
>
> **Source of truth:** [`CLAUDE.md`](./CLAUDE.md)
>
> *Archived: 2026-02-07*

---

# Phase 5: Stripe Billing, API Docs & Usage Tracking — Multi-Agent Plan (ARCHIVED)

## Context

Real Press needs to monetize its public verification API (`/api/v1/verify/*`). Phase 4 built the API with tier-gated responses (free = score only, pro = full breakdown), but users have no way to upgrade or pay. This phase adds Stripe billing so users can subscribe to Pro/Enterprise, API documentation so developers can discover and use the API, and usage tracking so users see what they're paying for.

**What already exists:**
- 4 verification endpoints: `/api/v1/verify/{text,url,image,batch}`
- API key auth + session auth via `verifyAuth()` in `src/lib/api/verify-auth.ts`
- Tier system: `UserTier` enum (FREE/PRO/ENTERPRISE) on User model
- `getUserTier()` in `src/lib/api/check-tier.ts` — reads tier from DB
- `hasBreakdownAccess()` gates pro/enterprise features
- Rate limiting via Upstash Redis (IP-based, per-endpoint)
- Profile page at `/profile` with "Upgrade options coming soon" placeholder
- API key management UI at `/profile/api-keys`
- Design system: 1920s retro newspaper aesthetic, CSS custom properties in `globals.css`

**What's missing:**
- No Stripe packages installed (need `stripe`)
- No billing fields on User model (stripeCustomerId, subscriptionId, etc.)
- No billing API routes or webhook handler
- No API documentation page
- No usage tracking or per-key request counting
- Profile page has placeholder upgrade text, no actual billing UI

## Architecture: 3 Parallel Agents

All agents branch from `main` and work simultaneously with zero file conflicts.

### Agent A: Stripe Billing Infrastructure
**Branch:** `phase5-agent-a-billing`

| File | Action |
|------|--------|
| `prisma/schema.prisma` | MODIFY — add Stripe billing fields to User, add `ApiUsage` model, add `ApiKey.usage` relation |
| `src/lib/services/billing.service.ts` | CREATE — Stripe customer, checkout session, portal session, webhook event handlers |
| `src/app/api/billing/checkout/route.ts` | CREATE — POST creates Stripe Checkout Session, returns redirect URL |
| `src/app/api/billing/portal/route.ts` | CREATE — POST creates Stripe Customer Portal session |
| `src/app/api/billing/webhook/route.ts` | CREATE — POST handles Stripe webhook events |

Tasks:
1. Run `npm install stripe` to add the Stripe SDK.
2. Add billing fields to User model in Prisma schema:
   - `stripeCustomerId String? @unique @map("stripe_customer_id")`
   - `stripeSubscriptionId String? @unique @map("stripe_subscription_id")`
   - `stripeSubscriptionStatus String? @map("stripe_subscription_status")` — active, canceled, past_due, etc.
   - `stripePriceId String? @map("stripe_price_id")`
   - `stripeCurrentPeriodEnd DateTime? @map("stripe_current_period_end")`
   - Add `apiUsage ApiUsage[]` relation on User
3. Add `ApiUsage` model for daily usage aggregation:
   ```prisma
   model ApiUsage {
     id           String   @id @default(cuid())
     userId       String   @map("user_id")
     apiKeyId     String?  @map("api_key_id")
     endpoint     String
     date         DateTime @db.Date
     requestCount Int      @default(0) @map("request_count")
     errorCount   Int      @default(0) @map("error_count")
     createdAt    DateTime @default(now()) @map("created_at")
     updatedAt    DateTime @updatedAt @map("updated_at")
     user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     apiKey       ApiKey?  @relation(fields: [apiKeyId], references: [id], onDelete: SetNull)
     @@unique([userId, apiKeyId, endpoint, date])
     @@index([userId, date])
     @@map("api_usage")
   }
   ```
   Also add `usage ApiUsage[]` relation on ApiKey model.
4. Run `npx prisma db push` to sync schema.
5. Create `billing.service.ts` with:
   - `getOrCreateStripeCustomer(userId, email, name?)` — creates Stripe customer if `stripeCustomerId` is null, returns customer ID
   - `createCheckoutSession(userId, priceId, successUrl, cancelUrl)` — creates Stripe Checkout Session for subscription
   - `createPortalSession(userId, returnUrl)` — creates Stripe Customer Portal session for managing subscription
   - `handleWebhookEvent(event)` — processes webhook events:
     - `checkout.session.completed` → look up user by customer ID, set tier based on price ID, save subscription fields
     - `customer.subscription.updated` → update tier, status, currentPeriodEnd
     - `customer.subscription.deleted` → set tier to FREE, clear subscription fields
     - `invoice.payment_failed` → set status to 'past_due'
   - `syncTierFromPriceId(priceId)` — maps `STRIPE_PRO_PRICE_ID` → PRO, `STRIPE_ENTERPRISE_PRICE_ID` → ENTERPRISE
   - Use env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`
6. Create `POST /api/billing/checkout`:
   - Session auth required (use `auth()` from NextAuth)
   - Accepts `{ priceId: string }` in body
   - Validates priceId is one of PRO or ENTERPRISE price IDs
   - Calls `createCheckoutSession()`, returns `{ url }` for redirect
   - Success URL: `{NEXT_PUBLIC_APP_URL}/profile?billing=success`
   - Cancel URL: `{NEXT_PUBLIC_APP_URL}/profile?billing=cancel`
7. Create `POST /api/billing/portal`:
   - Session auth required
   - User must have `stripeCustomerId` (return 400 if not)
   - Calls `createPortalSession()`, returns `{ url }` for redirect
   - Return URL: `{NEXT_PUBLIC_APP_URL}/profile`
8. Create `POST /api/billing/webhook`:
   - NO auth (Stripe sends this) — do NOT use `auth()`
   - Read raw body via `request.text()` for signature verification
   - Verify signature using `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`
   - Call `handleWebhookEvent(event)` for supported event types
   - Return 200 for all events (even unhandled) to prevent Stripe retries
   - Return 400 for invalid signatures
9. Run `npm run type-check` to verify.

### Agent B: API Documentation Page
**Branch:** `phase5-agent-b-docs`

| File | Action |
|------|--------|
| `src/app/docs/page.tsx` | CREATE — comprehensive API documentation |
| `src/app/docs/page.module.css` | CREATE — styles matching design system |
| `src/components/Header.tsx` | MODIFY — add "Docs" link to navigation |

Tasks:
1. Create `/docs` page as a server component (static, no client interactivity needed). Use the existing design system (CSS variables from `globals.css`). Structure:
   - **Hero section**: "Verification API" title, brief description, base URL (`https://www.real.press/api/v1`)
   - **Authentication section**: How to get an API key (link to `/profile/api-keys`), Bearer token usage, example header
   - **Endpoints section** — for each of the 4 endpoints:
     - `POST /api/v1/verify/text` — request body (`{ text }`, 50-50000 chars), response (free vs paid)
     - `POST /api/v1/verify/url` — request body (`{ url, extractMedia? }`), response includes `meta` object
     - `POST /api/v1/verify/image` — request body (`{ imageUrl }` or `{ imageBase64 }`), response
     - `POST /api/v1/verify/batch` — request body (`{ items[] }`), max items by tier (10/25/50), response
   - **Response format section**: Free response shape vs Pro/Enterprise breakdown shape
   - **Rate limits section**: Table of limits per endpoint (30/10/10/5 per minute)
   - **Error codes section**: 400, 401, 422, 429, 500
   - **Code examples section**: curl, JavaScript (fetch), Python (requests) for the text endpoint
   - **Tier comparison table**: FREE vs PRO vs ENTERPRISE features
2. Style the page with CSS Modules using the newspaper aesthetic:
   - Use `var(--font-headline)` for section headers
   - Use `var(--color-cream)` background for code blocks
   - Use `var(--color-charcoal-muted)` borders
   - `<pre><code>` blocks with monospace font, paper background
   - Left-justified, max-width 800px, comfortable reading width
   - Sticky table of contents sidebar on desktop (optional, skip if complex)
   - Mobile responsive
3. Modify `Header.tsx` — add a "Docs" link in the nav between "Submit" and the auth divider:
   ```tsx
   <Link href="/docs" className={styles.navLink} onClick={() => setMenuOpen(false)}>
     Docs
   </Link>
   ```

Reuses existing code (no modifications needed):
- Design system tokens from `globals.css`
- Header component pattern from `src/components/Header.tsx`

### Agent C: Usage Tracking & Profile Billing UI
**Branch:** `phase5-agent-c-usage-ui`

| File | Action |
|------|--------|
| `src/lib/services/usage.service.ts` | CREATE — usage logging + querying |
| `src/lib/api/check-tier.ts` | MODIFY — integrate Stripe subscription status |
| `src/lib/api/verify-auth.ts` | MODIFY — add usage logging after successful auth |
| `src/app/api/user/usage/route.ts` | CREATE — usage stats API |
| `src/app/profile/usage/page.tsx` | CREATE — usage dashboard |
| `src/app/profile/usage/page.module.css` | CREATE — usage dashboard styles |
| `src/app/profile/page.tsx` | MODIFY — replace upgrade placeholder with billing CTA, add usage link |
| `src/app/profile/page.module.css` | MODIFY — add billing/usage link styles |

Tasks:
1. Create `usage.service.ts` with:
   - `recordUsage(userId, apiKeyId, endpoint, isError)` — upserts daily aggregation row, increments `requestCount` (or `errorCount` if `isError`). Uses Prisma `upsert` with `@@unique([userId, apiKeyId, endpoint, date])`. Fire-and-forget pattern (don't block the request).
   - `getUsageStats(userId, days?)` — returns daily usage for last N days (default 30), grouped by endpoint. Returns `{ daily: [{ date, endpoint, requestCount, errorCount }], totals: { text, url, image, batch, total } }`.
   - `getUsageByKey(userId, apiKeyId, days?)` — same but filtered to a specific API key.
2. Modify `check-tier.ts`:
   - After querying the user, also check `stripeSubscriptionStatus`.
   - If `stripeSubscriptionStatus === 'active'` and `stripePriceId` maps to PRO or ENTERPRISE, return that tier.
   - If `stripeSubscriptionStatus === 'past_due'`, still return the paid tier (grace period).
   - If `stripeSubscriptionStatus === 'canceled'` but `stripeCurrentPeriodEnd > now()`, return paid tier (subscription still valid until period end).
   - Otherwise fall back to `user.tier` enum value (handles admin-set tiers and free users).
   - Add helper: `getSubscriptionStatus(userId)` → returns `{ tier, status, currentPeriodEnd }` for UI display.
3. Modify `verify-auth.ts`:
   - After successful auth (both API key and session paths), call `recordUsage()` with the endpoint derived from the request pathname.
   - Extract endpoint key from pathname: `/api/v1/verify/text` → `'verify-text'`, etc.
   - Pass `apiKeyId` (from API key validation) or `null` (for session auth).
   - This is fire-and-forget — do NOT await it or let errors block the response.
4. Create `GET /api/user/usage` route:
   - Session auth required (use `auth()`)
   - Query params: `?days=30` (default 30, max 90), `?keyId=<id>` (optional filter)
   - Returns `{ usage: { daily, totals } }` from `getUsageStats()` or `getUsageByKey()`
5. Create `/profile/usage` page (client component):
   - Fetch usage data from `/api/user/usage`
   - Display summary cards: total requests (this month), requests today, error rate
   - Daily usage bar chart (simple CSS bars, no charting library) for last 30 days
   - Breakdown by endpoint (text/url/image/batch) in a table
   - Per-API-key breakdown if user has multiple keys
   - Link back to profile
6. Modify `/profile/page.tsx`:
   - Replace the `upgradeNotice` placeholder with actual billing CTAs:
     - If tier is FREE: show "Upgrade to Pro" button that calls `POST /api/billing/checkout` with Pro price ID, then redirects to Stripe
     - If tier is PRO/ENTERPRISE: show "Manage Subscription" button that calls `POST /api/billing/portal`, then redirects to Stripe Portal
     - Show billing success/cancel messages from URL params (`?billing=success` / `?billing=cancel`)
   - Add "View API Usage" link to `/profile/usage`
   - Keep existing "Manage API Keys" link
7. Modify `/profile/page.module.css`:
   - Add styles for upgrade button (gold accent for Pro, primary green for Enterprise)
   - Add styles for usage link (same pattern as API key link)
   - Add styles for billing success/cancel banners

Imports from Agent A (code against these interfaces):
- `ApiUsage` model from Prisma (for `usage.service.ts`)
- User billing fields: `stripeCustomerId`, `stripeSubscriptionStatus`, `stripePriceId`, `stripeCurrentPeriodEnd` (for `check-tier.ts`)

Imports from existing code (no modifications):
- `auth()` from `@/lib/auth`
- `formatFreeResponse`, `formatPaidResponse` from `@/lib/ai-detection/format-breakdown`
- Existing verify endpoint response format stays unchanged

## Interface Contract (Critical)

`check-tier.ts` is the linchpin — Agent C modifies it, both verify endpoints and profile UI depend on it:

```typescript
// Updated by Agent C, already imported everywhere
export type UserTier = 'free' | 'pro' | 'enterprise'
export async function getUserTier(userId: string): Promise<UserTier>
export function hasBreakdownAccess(tier: UserTier): boolean

// New export by Agent C
export async function getSubscriptionStatus(userId: string): Promise<{
  tier: UserTier
  status: 'active' | 'past_due' | 'canceled' | 'none'
  currentPeriodEnd: Date | null
}>
```

`verify-auth.ts` signature stays the same — Agent C only adds a fire-and-forget `recordUsage()` call internally.

`billing.service.ts` created by Agent A, consumed by Agent C's profile page via API routes:

```typescript
// Created by Agent A
export async function createCheckoutSession(userId: string, priceId: string, successUrl: string, cancelUrl: string): Promise<string> // returns Stripe URL
export async function createPortalSession(userId: string, returnUrl: string): Promise<string> // returns Stripe URL
```

## Environment Variables (New)

```bash
STRIPE_SECRET_KEY="sk_live_..."          # Stripe server-side API key
STRIPE_WEBHOOK_SECRET="whsec_..."        # Stripe webhook signing secret
STRIPE_PRO_PRICE_ID="price_..."          # Stripe price ID for Pro monthly
STRIPE_ENTERPRISE_PRICE_ID="price_..."   # Stripe price ID for Enterprise monthly
```

## Merge Order

1. **Agent A first** (schema + Stripe infrastructure)
2. **Agent C second** (depends on A's schema for ApiUsage model and User billing fields)
3. **Agent B last** (independent, but safest last since it touches Header)

Then: `npx prisma generate && npx prisma db push && npm run type-check && npm run build`

## Verification

After merging all three branches:
1. `npm run type-check` — no errors
2. `npm run lint` — no new errors
3. `npm run build` — builds successfully
4. Create a test user, verify `/profile` shows "Upgrade to Pro" button
5. Click upgrade → redirects to Stripe Checkout (use Stripe test mode)
6. Complete checkout with test card `4242 4242 4242 4242` → redirected back to `/profile?billing=success`
7. Verify user tier updated to PRO (check via admin endpoint or DB)
8. Verify `/api/v1/verify/text` now returns full breakdown for this user
9. Visit `/profile/usage` → see request counts
10. Visit `/docs` → comprehensive API documentation page loads
11. "Manage Subscription" button on profile → opens Stripe Customer Portal
12. Stripe webhook test: `stripe trigger customer.subscription.deleted` → user downgraded to FREE
