# Cloudflare public site closure — 2026-10-18

**CLOUDFLARE PUBLIC SITE LIVE — COMMERCE OFFLINE**

This is the owner-approved interim frontend-only architecture, not full production-commerce completion.

## Release identity

- Public HTTPS origin: https://herb-all-public.mmwarunge.workers.dev
- Worker: `herb-all-public`, existing owner-approved Free account; no custom-domain/DNS change.
- Application Git commit: `d73858e9ea034b970a770aef080e65b2765dba8e`.
- Active deployment: `943c4715-db7e-4352-9f81-5f53049f9f4d`.
- Active version (100%): `2ce6d995-5634-4d37-ba45-21258e408591`, published 2026-10-18 08:23:40 EAT.
- Source/review: `feat/cloudflare-static-interim`, PR https://github.com/mmwarunge-droid/herb-all/pull/11.
- This report is a subsequent documentation-only commit; it does not change the deployed application artifact.

PR #9 imagery/navigation remains included. PR #10 and Vercel adapters remain separate, unmerged and preserved. This source branch starts from main, not the Vercel branch.

## Public experience and offline services

All 47 index routes (plus the generated 404 page) build. Home, About, Gardens, Products, Seedlings, Learn, Contact, legal pages, public detail routes, image credits and catalogue work. Supplied photography and temporary licensed responsive imagery are retained. Founder spelling remains David Muriu Warunge.

The interim `/shop/` presents only six already-public product profiles and six already-public seedling profiles from repository content collections. It does not import/publish the 63 database records. There are no invented live prices, stock quantities, publication changes or stock claims. Exact notice:

> Online ordering is temporarily unavailable. Please contact Herb-All to confirm current availability.

Contact/email/WhatsApp enquiries remain accessible. Cart is absent from navigation. Direct cart/checkout/order/admin URLs show clear unavailable notices without forms, login, payment instructions or backend requests. Underlying commerce/admin/server code remains intact for later restoration.

`COMMERCE_CHECKOUT_ENABLED=false` is enforced by the static build; the deployed Worker contains no commerce business logic at all. Payments are disabled. Orders, inventory reservations and payment-evidence submissions cannot be made on this deployment. `/api` and `/api/*` return intentional sanitized 503/no-store/noindex responses, never fabricated products or customer records.

No production database connection, query, write, reseed, migration, administrator creation or signing-key rotation was performed. The existing two Super-admin accounts, 63 records and financial/authentication state were not changed by this deployment; fresh database integrity certification remains unavailable while its provider is disabled.

## Deployment isolation and cost

Remote settings were reread after deployment: **ASSETS is the only binding; zero secret bindings**. No DATABASE_URL, ORDER_TOKEN_SECRET, administrator credentials, payment secrets, sessions, database integration, API runtime or scheduled-maintenance service was deployed. Preview URLs are disabled; static-only previews/development need no production credentials. The artifact scan passes; operational authentication remains outside Git and outside the deployed Worker.

New recurring hosting cost: **KES 0**, using Cloudflare Free static assets plus minimal unavailable-response Worker execution within free quotas. No payment card, upgrade, paid resource or subscription was added. The account owner confirmed Free; the OAuth token cannot enumerate subscriptions (403), so an independent billing-subscription inventory was not available. Free-compatible deployment features were used throughout; do not upgrade automatically if quotas are reached.

Live HTML, sitemap, RSS and robots return 200 with Brotli compression and `public, max-age=0, must-revalidate`. Sample retained image returns 200 with one-day caching. Closed-service HTML uses `no-store` and `noindex`. API responses use `no-store` and `noindex`; unknown public routes return the intentional 404 page. Fingerprinted `/_astro/` assets have immutable-cache configuration where present. Static pages are served by the asset system, not unnecessary Worker execution.

All page canonicals/metadata use the Cloudflare origin. Live sitemap index/chunk, RSS and robots were reread and verified. An initial deployment exposed a pre-existing config-time sitemap-origin fallback to the example domain; `astro.config.ts` was corrected to read the explicit build origin and build-time canonical/feed assertions added. The corrected version above supersedes the first deployment; no incorrect origin remains in the verified live feeds.

## Validation

- Astro check: 82 files, zero errors, warnings or hints.
- Static production build: 48 pages; safety/SEO origin scans pass.
- Build tests: 4 passed, covering metadata/JSON-LD/internal links, RSS, image assets and provenance mappings.
- Existing regular frontend browser suite: 17 passed; future commerce UI remains preserved.
- Local Cloudflare static suite: 7 passed, including 235 route/viewport combinations (47 routes at 320, 375, 768, 1024 and 1440 px), image loading, no automatic API calls, navigation/contact, closed-services and automated accessibility checks.
- Live Cloudflare suite: 7 passed with the same route/viewport and functional coverage. No real backend/payment test was attempted.
- Targeted corrected-version live audit: canonical origin, sitemap index/chunk, RSS, robots, founder spelling, public/closed-service cache headers, compression, sample image, 404 and API 503 all pass.
- Final local formatting and diff whitespace checks pass.
- Local packaging: 0.51 KiB Worker / 0.31 KiB gzip; only ASSETS binding.

The expanded local checks found long attribution filenames causing mobile overflow; wrapping fixed the issue without modifying credits. One image test overlapped a local rebuild; a full stable-artifact rerun passed. No production statement or customer operation was involved.

## Remaining backend work

Netlify PostgreSQL next expected credit reset is **October 22, 2026 at 10:00 EAT**. Restoration and read-only integrity/TLS checks are a separate task; do not assume a reset guarantees restoration. Preserve the existing ORDER_TOKEN_SECRET (still required privately), existing database records and password hashes. A future approved production Node/API host, isolated credentials, security/integration acceptance and 15-minute maintenance runtime are still required before any commerce restoration. Checkout/payment launch remains a separate owner decision.
