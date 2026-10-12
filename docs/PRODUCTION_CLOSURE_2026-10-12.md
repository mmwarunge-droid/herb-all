# Production closure — 2026-10-12

## Production status

**PRODUCTION DEPLOYED — CHECKOUT DISABLED**

This supersedes the unresolved database/configuration findings in the October 11 audit. Founder spelling remains David Muriu Warunge. No real payment was made and checkout was never enabled.

## Deployment

Production: https://herb-all.netlify.app/. Audited application commit: `fa634823cbdda2e9d566d81d3f4fc1de38026853`; refreshed deployment `6acc469c15114138f5772fc7` is ready. Both Functions are deployed; maintenance schedule is `*/15 * * * *`. Successful live commerce database access is verified. Sampled maintenance logs contain four info-level execution-duration summaries and no error markers; they do not expose individual SQL transaction results. The subsequent documentation merge/deployment identity is recorded in the final response.

Required configuration confirmed: DATABASE_URL and ORDER_TOKEN_SECRET configured (values withheld), DATABASE_SSL=true, APP_ENV=production, COMMERCE_CHECKOUT_ENABLED=false, PUBLIC_SITE_URL=https://herb-all.netlify.app. Secret strength and preview/development database isolation cannot be established from masked provider values.

## PostgreSQL

The owner supplied the read-write connection. Public-schema USAGE/CREATE privileges passed. Certificate-verified TLS 1.3 negotiation passed at the database endpoint. Local connections were intermittent; successful provisioning used explicitly resolved IPv4 with certificate verification against the original hostname. Application TLS controls were unchanged.

Repository migrations 001, 002 and 003 applied atomically. Rerunning applied nothing and verified existing checksums. No products, accounts, orders or payments were seeded. Seventeen tables exist, including schema_migrations; constraints: 25 CHECK, 17 foreign keys, 17 primary keys, 7 unique. Reservations are represented on orders/products and the inventory ledger, not a separate stock_reservations table. A diagnostic lookup of that nonexistent table returned 42P01 without changing data.

The initial rebuild retained insufficient runtime permissions. A further build through the existing main pipeline resolved live 42501 errors; products/settings now return 200.

## Administrators

mmwarunge@gmail.com is an active Super created through the existing hidden-password CLI. After its production login, dwmuriu725@gmail.com was created as active Super through deployed protected Accounts. Strong generated credentials are retained only in an owner-only private local handoff file, mode 600; no credentials or sessions are in Git or this report.

Both live logins passed. Desktop/mobile UI checks passed Accounts/product views, reload persistence and logout with zero page exceptions. Secure/HttpOnly cookies passed; missing CSRF returned 403, invalid login/anonymous Accounts returned 401, logged-out session returned 401. No approved account was demoted/disabled for testing; destructive role scenarios remain certified by isolated tests.

## Catalogue

The explicit CLI imported all 63 approved varieties. Every SKU price matches the manifest. Published: 0; nonzero stock: 0; nonzero reserved: 0; all unavailable. Zero stock means unconfirmed, not actual physical stock. No photos were fabricated. A fresh-connection rerun created 0 and preserved 63. An earlier rerun encountered intermittent local connectivity and was retried without changing records. Public products total remains 0. Orders/payments remain 0.

## Payments and checkout

Protected Super settings contain +254722603819 (0722603819). Payee remains blank/unverified; payment_enabled=false. Stored instructions distinguish 50% merchandise delivery deposit, separately quoted transport and no-upfront farm collection/full settlement before handover; instructions remain gated by payment enablement.

Live settings report checkout_enabled=false. Empty order request returns intentional 503 closed-launch response without an order/reservation/payment. No real payment or reconciliation was performed.

## Tests

Fresh October 12 checks of the unchanged application source:

- Astro: 67 files, zero errors/warnings/hints; build: 47 pages.
- Build tests: 3 passed; formatting passed.
- Isolated PostgreSQL commerce backend: 37 passed.
- Commerce browser: 5 passed; explicit disabled-checkout run: 1 passed.
- Original browser: 10 passed.
- Official Netlify packaging: both API v2 Functions passed.
- Repeated live audit: 28 route checks at 390px/1440px, 24 HTML layouts, zero exceptions/overflow/failed visible images.
- Five browser bundles checked for secret configuration/local paths; none found. Sitemap: 41 public URLs, private pages excluded; canonical/JSON-LD checks passed.
- Two live authenticated admin browser checks passed.
- Final bounded API probes: products/settings 200, anonymous Accounts/invalid login 401, invalid tracking/nonexistent media 404, closed checkout 503. All no-store/noindex and sanitized.

## Security and coverage

Isolated suites cover server-side roles, CSRF, last-Super protection, private order/receipt access, raster re-encoding, duplicate financial/admin operations, expiry and inventory concurrency. Live authentication/session/CSRF and invalid tracking/media probes passed. No production orders/receipts exist; cross-customer access, actual finance and existing-order reconciliation were not fabricated. No production outage was induced. Public security headers and private indexing/cache behavior remain intact.

## Remaining launch gates

Verify exact Pochi payee, enter actual stock, publish selected inventory, authorize payment reconciliation, verify preview/development database isolation and obtain explicit owner checkout-launch approval. Checkout and payments stay disabled until applicable gates pass.

## Git and artifacts

This is a focused documentation closure; no application functionality or styling changed. Environment files, onboarding credentials, logs, browser artifacts, function archives and test databases remain outside Git. Temporary regression processes finished and the isolated PostgreSQL server was stopped. Retrieve onboarding credentials privately and remove the handoff file after secure storage; never paste its values into chat or reports.
