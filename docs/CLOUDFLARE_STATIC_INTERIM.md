# Cloudflare public frontend — interim production plan, 2026-10-18

This is an intentional frontend-only architecture. Commerce remains offline. It does not complete the production-commerce migration. PR #10 and its Vercel adapters remain separate and unmerged; this branch starts from main with PR #9 imagery/navigation already included.

## Deployment artifact

Cloudflare Workers Free + Static Assets serves Astro `dist/` directly. Only `/api` and `/api/*` run a minimal Worker, returning intentional sanitized 503/no-store/noindex responses. The Worker has no business-module imports, network fetches, database bindings, cron, payments or secrets. Static pages use revalidation, fingerprinted `/_astro/` assets use immutable caching and images use one-day caching. HTTPS/compression are provided by Cloudflare; verify live responses after deployment.

Build with `PUBLIC_SITE_URL=https://herb-all-public.mmwarunge.workers.dev npm run build:static`. The real assigned account subdomain must be obtained from the authenticated account before building; do not publish an example canonical. `build:static` forces `PUBLIC_FRONTEND_ONLY=true` and `COMMERCE_CHECKOUT_ENABLED=false`, generates sitemap/RSS/robots and runs a static secret/commerce-UI scan. Do not use plain `npm run build` for this deployment: that preserves the future commerce frontend for backend restoration and existing regression tests.

Before deploying, use `npx wrangler whoami` to confirm the owner-approved Free account. Authentication is required; do not use a temporary anonymous account. Inspect `npx wrangler deploy --dry-run --outdir /tmp/herb-static-upload` and confirm there are no secrets, remote service/database bindings or schedules. Then `npx wrangler deploy`, record version/URL, and verify the exact deployed origin, all public routes, API 503s, metadata, cache headers and mobile behavior. No DNS changes or paid products are needed. Never enable Workers Paid, R2, Images, a database integration or a subscription to complete this interim deployment.

Owner-approved account authentication is now confirmed. The assigned Workers subdomain is `mmwarunge`; the intended production origin is `https://herb-all-public.mmwarunge.workers.dev`. Deployment/version and live acceptance are recorded separately after publishing. No paid resource is authorized. Local builds use `https://herb-all.example` only as a test origin. After authentication, rebuild using the actual assigned workers.dev origin before uploading. Do not claim the test origin is production.

## Catalogue and closed services

`/shop/` renders only already-public, non-draft `src/content/products` and `src/content/seedlings` profiles. It does not import the 63-row approved database seed manifest or read PostgreSQL. The interim shop contains six existing public product profiles and six existing public seedling profiles. Existing `/products/`, `/seedlings/` and detail pages retain their educational/sample catalogue content, supplied photos, responsive temporary licensed imagery, captions and image credits. No live stock, price confirmation or publication state is invented.

Exact notice: “Online ordering is temporarily unavailable. Please contact Herb-All to confirm current availability.”

Shop profiles are labelled as informational examples, not live inventory, stock quantities or confirmed prices. Cart is removed from navigation. Direct cart, checkout, tracking and admin URLs render intentional unavailable notices, no forms and no backend requests. The underlying storefront, admin and server code remains intact, guarded out of the static browser build. Enquiries use existing contact/email/WhatsApp paths; no Netlify Forms dependency, payment instructions or payment evidence flow is enabled.

## Isolation and restoration

Do not upload DATABASE_URL, ORDER_TOKEN_SECRET, administrator credentials, sessions, private handoff files or payment secrets. Cloudflare has only static assets and the small unavailable-response Worker. Production/Preview/Development all lack database bindings and credentials; preview URLs are disabled in Wrangler configuration. No production database operation or account creation is part of this task.

Existing Netlify PostgreSQL next expected credit reset: **October 22, 2026 at 10:00 EAT**. Restoration is a separate task; the reset is not a promise that connectivity is restored. Preserve existing two Super-admin accounts, 63 catalogue records, stock, prices, order/payment state, password hashes and migration history. Existing ORDER_TOKEN_SECRET remains required for future restoration; do not rotate it.

Future commerce restoration requires an approved Node/API host and 15-minute maintenance runtime, verified PostgreSQL availability/TLS/data preservation, the existing order-token secret, authenticated browser/security checks and a separate launch decision. Remove the static-only mode deliberately only after those gates pass. Keep checkout and payments disabled throughout this interim deployment.

## Validation

`npm run check`, `npm run build:static` with an explicit HTTPS test origin, `npm test`, `npm run test:static:browser`, `npm run format:check`. The new suite uses local Cloudflare workerd and checks all 47 generated index routes at 320/375/768/1024/1440 px, image integrity, no API spam, catalogue/closed-service/contact/navigation/accessibility behavior and intentional API 503 responses. Existing frontend/browser tests run against the preserved regular build separately. No local test constitutes a live deployment certificate.

New recurring hosting cost: **KES 0** on Cloudflare Free, subject to free quotas; never upgrade automatically. Static asset requests are free/unlimited under current provider documentation. Dynamic API-unavailable responses count toward Workers Free request limits; excess requests may fail rather than incur an authorized paid upgrade. See [Cloudflare asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

Wrangler's custom build also forces `npm run build:static`, so a deployment cannot accidentally upload the regular commerce build. Supply the verified public origin to the Wrangler invocation too. The local dry run/test origin is never a production assignment.

## Local validation record

- Astro check: 82 files, zero errors/warnings/hints.
- Production static build: 48 pages (47 index routes plus the 404 page).
- Build checks: 4 passed, including metadata/internal links/JSON-LD, RSS and image integrity/provenance.
- Preserved regular frontend browser suite: 17 passed.
- Static Cloudflare browser suite: 7 passed; 235 route/viewport combinations, images, zero automatic API calls, closed service pages, contact/navigation and automated WCAG checks, plus intentional API 503s.
- Static secret/commerce scan passed. Local Cloudflare dry run: 0.51 KiB Worker, gzip 0.31 KiB; ASSETS is its only binding.

The expanded responsive tests identified long attribution filenames overflowing on small screens; wrapping was corrected without changing attribution. A subsequent image check overlapped a local dry-run rebuild; the full suite rerun against a stable artifact passed. No production resource or request was involved. These results certify local preparation, not a live URL, HTTPS/compression behavior or Cloudflare account configuration.

Authentication was supplied privately by the owner. Wrangler confirms the intended account and existing `mmwarunge` Workers subdomain. No upgrade, paid feature, DNS change or database access is part of the deployment. The OAuth subscription-list read is unavailable (403); the owner confirms Free, and deployment uses only Free-compatible features. Existing backend blockers do not prevent this frontend-only release.
