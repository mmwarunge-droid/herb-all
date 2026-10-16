# Vercel migration — 2026-10-14

**BLOCKED: code prepared; no hosted preview or production cutover. Checkout remains disabled.**

The owner requires zero recurring hosting cost and expressly forbids a paid upgrade. The authenticated `mmwarunge-droids-projects` team is Hobby. No Herb-All Vercel project, environment variables, deployment, paid resource or new database was created.

## Plan limits and deployment decision

[Vercel Hobby](https://vercel.com/docs/plans/hobby) is restricted to non-commercial personal use. [Fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines) classify advertising products/services as commercial: disabling checkout does not make Herb-All eligible. A commercial preview is also a deployment; it is not a workaround. Hosted preview and production remain blocked.

[Hobby cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) runs at most daily, with hourly scheduling precision. The required `*/15 * * * *` is unsupported and rejected at deployment. `vercel.json` deliberately contains no active cron; the schedule has not been silently reduced to daily. The legacy Netlify schedule remains unchanged. Before commerce opens, an approved scheduler must execute maintenance every 15 minutes and successful runs must be observed.

## Runtime and local preview

Astro still produces static `dist/` pages. Native Node Web Request/Response functions in `api/[...path].mjs` preserve nested `/api/*` URLs and call the existing business handler. `api/maintenance.mjs` calls shared maintenance logic. There is no Next.js rewrite, SSR conversion, build migration, catalogue import or account bootstrap. Vercel SDK supplies platform client IP and attaches the existing PostgreSQL pool for idle-connection management. Database sessions, CSRF/origin checks, transactions, uploads and order tokens retain existing business logic.

Set `HOSTING_TEST_DATABASE_URL` to the disposable test URL to include the eighth, database-backed hosting check (otherwise it is explicitly skipped).

Run `npm ci`, `npm run check`, `npm run build`, `npm run test`, `npm run test:hosting`. `npm run preview:vercel` exercises the Web adapters through the local HTTP/static server. For database tests use ONLY a disposable database whose name ends in `herb_all_test`; the tests truncate records. Local validation does not certify Vercel routing, deployment packaging, cold starts or production latency. Those remain hosted acceptance gates before merging this migration.

Maintenance accepts GET `/api/maintenance` with `Authorization: Bearer <CRON_SECRET>`. The production-only secret must have at least 32 characters. Missing configuration, wrong credentials, non-production environments and failures return private sanitized errors; only successful maintenance returns 204. Never put secrets in the URL, browser or repository. No production cron was executed.

Vercel has a [4.5 MB function payload limit](https://vercel.com/docs/functions/limitations). Existing 2 MB raster uploads encoded as JSON/base64 fit; oversized requests can receive a gateway 413 before application validation. Sharp stays in Node, not Edge. Actual deployed packaging/routing still requires a permitted host.

## Environment isolation and preservation

Set `DATABASE_URL`, `DATABASE_SSL=true`, `APP_ENV=production`, existing stable `ORDER_TOKEN_SECRET`, `COMMERCE_CHECKOUT_ENABLED=false`, `CRON_SECRET` and optional server integration secrets only in Production. Use Secret visibility, not public/config values. Never upload `.env` files. Preview and Development receive no database or order/cron secrets; an adapter guard rejects even accidentally shared database configuration in those Vercel environments before connecting. Development database tests run locally with their own disposable database.

Production requires an explicit `PUBLIC_SITE_URL` at build and runtime; no Netlify-origin fallback remains. The real new production origin is not assigned yet. The example origin in local builds is not a deployed canonical claim. Legacy Netlify Forms are disabled on Vercel; contact email/WhatsApp remain available. Keep `PUBLIC_ENABLE_NETLIFY_FORM=false`.

The existing production PostgreSQL endpoint rejected current read-only connection attempts with code 28000, classified as provider-disabled. No query/migration/write ran. Fresh schema, record counts, TLS query, admin login and token compatibility cannot be certified. Prior closure counts are historical evidence only. No database replacement, reseed, account recreation or signing-key rotation occurred. The owner will privately supply the existing ORDER_TOKEN_SECRET; preserve it before any eventual cutover. Checkout and payments must stay disabled.

## No-cost alternatives to evaluate

A public static site on [Cloudflare Pages Free](https://developers.cloudflare.com/pages/platform/limits/) is a candidate within its free quotas. An existing owner-funded Node host could run this API and system cron without a new hosting subscription, if one is available. Another evaluation option is [Render Free Node](https://render.com/docs/free) plus a [Cloudflare Worker Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/) making an authenticated HTTP request every 15 minutes. This requires an approved server adapter/same-origin proxy and provider configuration; it is not provisioned here.

Render free instances sleep after 15 idle minutes, have cold-start delays, shared monthly hours, ephemeral disk and usage limits; Render advises against production use. Its paid cron product is not a free alternative. Worker quotas and terms must be checked at setup, secrets scoped privately and scheduled execution observed. These options are candidates for a public site or closed-commerce evaluation, not a claim of reliable production commerce at zero cost. Do not add a payment method, enable overages or create paid resources without explicit approval. The existing disabled database remains a separate blocker whatever frontend host is selected.

## Cutover and rollback gates

Keep the migration PR unmerged until permitted hosted preview, static/routes/images, native API bundling, isolated preview errors and CI pass. Then verify production DB availability and TLS, existing schema/data, existing admin login/session/CSRF, preserved order-token secret, checkout closed, matching origin/canonical/sitemap and authenticated 15-minute maintenance. No build may migrate production. Production deployment is not authorized to bypass these gates.

Netlify adapters and `netlify.toml` remain legacy rollback material. The site remains paused/503; no paid restoration or old-host redirect was configured. Vercel source imports no Netlify runtime module. Do not remove legacy files until a real new production deployment passes acceptance. Current migration is code preparation, not a completed hosting migration.
