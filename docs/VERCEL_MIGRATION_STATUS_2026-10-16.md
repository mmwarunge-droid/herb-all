# Hosting migration status — 2026-10-16

**BLOCKED. No Vercel hosted preview or production cutover. Checkout remains disabled.**

PR #9 was reviewed and merged before this work; main merge commit `f87bef740c740848150316bb20856b9662d4292b` preserves the imagery and navigation upgrade. Migration work is isolated on `feat/vercel-migration` and must remain unmerged while hosted acceptance gates are unavailable.

## Implemented

Static Astro frontend plus native Node `/api/*` and protected maintenance adapters reuse existing business modules. Shared maintenance preserves legacy Netlify behavior. Preview/Development database admission fails closed. Production requires an explicit site origin; Netlify Forms are disabled on Vercel. Existing order tokens, admin records, inventory and security business logic were not replaced. Production has not been migrated, reseeded or written to.

## Validation

- Locked `npm ci`: 365 packages installed, zero reported vulnerabilities.
- `npm run check`: 81 files, zero errors, warnings or hints.
- `npm run build`: 48 static pages; sitemap alias generated.
- `npm run test`: 4 passed.
- `npm run test:hosting` with isolated database: 8 passed, including production credential isolation and authenticated maintenance 204. Default without the isolated URL runs seven guards and explicitly skips the database check.
- `npm run test:commerce`: 37 passed against disposable PostgreSQL 16.
- `npm run test:browser`: 17 passed, including automated accessibility, mobile layouts, images and navigation.
- `npm run test:commerce:browser` through Vercel Web adapters: 5 passed against isolated data, including admin sessions, purchase flows and closed-checkout messaging.
- Formatting and diff whitespace checks pass.

The local PostgreSQL service was stopped across the interrupted session; the first resumed regression run failed with connection refused. After restarting that disposable service, all 37 tests passed. An earlier sandbox dependency installation failed with esbuild EPERM; the authorized unsandboxed locked install and checks passed. Neither failure involved production.

These are local checks, not Vercel deployment/build-output certification or production performance results. Hosted native catch-all routing, Sharp packaging, platform headers/limits, live PostgreSQL/admin login, SEO origin and scheduled invocation remain acceptance gates.

## Unresolved external gates

The existing Vercel team is Hobby: commercial deployments (including product marketing with checkout disabled) are disallowed and the required 15-minute cron is unsupported. No project, hosted preview, secret upload, upgrade or paid resource was created. See [migration guide](VERCEL_MIGRATION.md) for official sources, scope and no-cost alternatives.

Production PostgreSQL currently rejects connections with provider-disabled code 28000. Fresh schema/count/data-preservation queries and live account verification are unavailable. Prior production closure remains historical evidence; this report does not re-certify it. The private production file is mode 600; the existing ORDER_TOKEN_SECRET was still absent on the latest presence check. No secret was generated or rotated. Preserve that existing secret before any future cutover.

Netlify remains paused/unavailable. Legacy configuration is retained for rollback and is not imported by the Vercel runtime. No old-host redirect could be installed while it is unavailable. The new production origin, deployed SHA and preview/production URLs do not exist yet.
