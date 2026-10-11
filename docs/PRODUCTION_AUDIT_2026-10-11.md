# Production audit — 2026-10-11

## Production status

**PRODUCTION DEPLOYED — CHECKOUT DISABLED**

The public website is operational. Production commerce is blocked before database connection by incompatible SSL parameters in the configured connection URL. Database connectivity, production schema, administrator accounts and catalogue import are not certified by this audit. Passing isolated tests do not establish those production results.

## Deployment

- Production URL: https://herb-all.netlify.app/.
- Audited application commit: `d30162e54e90007e2bc801d483a00f5e46a6b015`, matching remote `main` at inspection.
- Verified existing project: `herb-all`, site `aba21307-38a9-41af-8cdc-9126840040e2`, repository `mmwarunge-droid/herb-all`, production branch `main`.
- Previous published deployment: `6ac9f96c0d227c0008b3f956`; its Functions reported missing database configuration.
- Requested a rebuild through the existing Netlify repository build pipeline. Refreshed production deployment `6acbb522dbf40a6c0a0a2b9c` is `ready`, at the same application commit. Authenticated build logs contain zero error/fatal-level entries.
- Both deployed Functions, `commerce` and `maintenance`, use Node.js 22. `commerce` executes and returns sanitized configuration errors. `maintenance` is registered with `*/15 * * * *`; build logs also confirm scheduling. Successful database maintenance execution is not verified.
- This audit adds documentation only. Any subsequent documentation merge/deployment identity is recorded in the final response; application source is unchanged.

### Production environment audit

Authenticated Netlify metadata and production Functions-scoped resolution establish:

| Variable                    | Verified state                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Configured as a secret; value is masked and unavailable to local migration/bootstrap commands                       |
| `DATABASE_SSL`              | `true`                                                                                                              |
| `APP_ENV`                   | `production`                                                                                                        |
| `ORDER_TOKEN_SECRET`        | Configured as a secret; value/strength cannot be independently inspected                                            |
| `COMMERCE_CHECKOUT_ENABLED` | `false`                                                                                                             |
| `PUBLIC_SITE_URL`           | Missing from production environment; existing static canonical URLs correctly use Netlify's production URL fallback |

The CLI origin-update attempt returned without persisting a value. Direct environment-write API requests using both the site's account slug and verified account ID returned HTTP 403. A following read did not find `PUBLIC_SITE_URL`. The origin was **not** configured by this audit. The earlier automatic approval-review timeout was resolved by its authorized retry; the outstanding write restriction is Netlify's API response, not an unresolved sandbox approval.

Database and order-token secret metadata includes production, deploy-preview, branch-deploy, dev and dev-server contexts. Masking prevents determining whether these contexts hold distinct values. Before enabling commerce, verify production database/token isolation and remove production values from non-production contexts or use separate staging credentials. This is not evidence of browser exposure or a claim that the masked values are identical.

## PostgreSQL

After deployment refresh, public products/settings APIs return HTTP 503:

> Configure TLS with DATABASE_SSL instead of connection URL SSL flags.

`server/db.mjs` rejects `sslmode`, `sslcert`, `sslkey` and `sslrootcert` query parameters before connecting. These parameters can override the separately configured verified-TLS settings in the PostgreSQL driver. The response proves at least one prohibited parameter exists; it does not identify which one. Retain `DATABASE_SSL=true` and certificate verification. Correct the private connection URL; do not disable TLS or relax the guard.

- Production authentication/TLS handshake: not reached or verified.
- Production migrations and schema: unknown; no production migration was run.
- Expected migrations: **001, 002 and 003**. Migration 003 preserves historic order terms and opts new farm collections into payment at pickup.
- Fresh isolated PostgreSQL 16 database: all three migrations applied successfully; a second run made no changes. No automatic product, administrator, order or payment seeds exist.
- Isolated schema inspection: 25 check, 17 foreign-key, 17 primary-key and seven unique constraints. These cover stock/reservation bounds, payment-reference uniqueness, financial bounds and operation receipts. These totals are not production schema evidence.
- No production database restore, outage, customer mutation or test inventory was introduced.

The approved production connection was requested through private configuration at `/tmp/herb-all-production.env` with permissions 600 (or the private session environment). It was unavailable at audit closure. Netlify's masked value cannot safely be used as a substitute.

## Administrators

Approved emails remain `mmwarunge@gmail.com` and `dwmuriu725@gmail.com`. Existing production account state is unknown. No administrator was created in this audit; production sign-in, logout, sessions and role operations remain unverified because the database-backed API is blocked.

The existing CLI permits one hidden-password bootstrap only, stores a scrypt hash and rejects repeat bootstrap. After database/schema verification, use `npm run admin:create -- mmwarunge@gmail.com`, then sign in and create the second approved administrator through Accounts. Do not bypass roles or provision production accounts with synthetic test credentials.

## Catalogue

- Prepared products: **63** owner-approved varieties and KES prices.
- Production imports executed by this audit: **0**.
- Existing imported/published/verified-stock counts: **unknown**, because production inspection could not reach PostgreSQL.
- Importer inspection and fresh isolated regression pass: active Super required; explicit invocation; serialized transaction; unpublished/unavailable drafts; zero unconfirmed stock; existing SKUs and admin edits preserved on repeat.

After provisioning, run `npm run catalogue:import -- mmwarunge@gmail.com`. Inspect existing records first, verify prices and enter physical stock through authorized adjustments before publishing. No stock, photos or payee was invented.

## Payments

Pochi `0722603819` / `+254722603819` is owner-approved and recorded in the setup guide. Production Business settings could not be read, so its configured number and `payment_enabled` value are **not verified**. Exact payee verification remains unavailable. Payments must remain disabled pending the actual payee and account confirmation. No live payment, evidence submission, verification or refund was executed.

Fresh isolated tests verify the Super-only explicit payment-enablement guard, receipt privacy/re-encoding, duplicate-reference protection, manual verification, overpayment reconciliation and bounded refunds. Delivery remains a 50% merchandise deposit with transport separate. New Rongai farm collection requires no upfront deposit, can be prepared after stock confirmation, and requires full verified payment before handover. Historic order snapshots remain unchanged.

## Checkout

The production environment flag is verified `false`. Public checkout displays no payment request. An empty order POST returns sanitized HTTP 503 from the database configuration guard, rather than the intended closed-launch response; the functional launch gate cannot be certified end to end until connection/schema setup completes. These probes cannot reach reservation transactions while the connection guard rejects the URL. Production reservation counts could not be compared.

The real disabled-checkout isolated browser test verifies rejection, no order/reservation creation and continued administration. Existing-order reconciliation passes isolated tests; it is currently unavailable through the blocked production database API.

## Tests

All results below were run freshly for this audit, not copied from prior validation:

| Check                               | Result                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Astro/type checks                   | 67 files; zero errors, warnings or hints                                               |
| Production-origin build             | 47 pages                                                                               |
| Build tests                         | 3 passed                                                                               |
| PostgreSQL commerce backend tests   | 37 passed                                                                              |
| Commerce browser tests              | 5 passed                                                                               |
| Real disabled-checkout browser case | 1 passed                                                                               |
| Original browser tests              | 10 passed                                                                              |
| Formatting / diff checks            | Passed                                                                                 |
| Official Netlify Function packaging | 2 passed; API v2, Node 22, native Sharp included                                       |
| Live requested routes               | 28 checks: 14 routes at 390px and 1440px                                               |
| Live HTML layout/assets             | 24 checks; zero JavaScript exceptions, overflow or failed visible images               |
| Live browser bundles                | 5 checked; no private environment names, database URLs or local filesystem paths found |
| Sitemap                             | 41 public URLs; correct origin; private routes excluded                                |
| Bounded live API probes             | 7 sanitized responses; five database-guard 503s, cross-origin 403, malformed-JSON 400  |

Raw robots/XML responses were checked as resources rather than HTML layout tests. Public HTML canonical URLs use the production origin; JSON-LD parses. Admin/cart/checkout/order pages are noindex; APIs return no-store/noindex. Public founder name remains **David Muriu Warunge**, with no incorrect spelling found in repository text. No founder biography, credentials, imagery, layout or functionality was modified.

## Security

Live headers include targeted CSP, DENY frame protection, nosniff, Referrer-Policy, provider HSTS and no-store/noindex on private APIs. The existing CSP is not a claim of a full script-source allowlist. Live cross-origin writes and malformed JSON are rejected before database work; sampled responses contain no SQL, stack traces, connection URLs, password hashes or local paths.

Authentication, authorization, CSRF, last-Super/session revocation, order-token separation, receipt access/re-encoding, duplicate payments/refunds/operations, stock constraints, concurrency, expiry and rollback pass the fresh isolated backend/browser suites. Database-dependent production security behavior remains unverified; HTTP 503 is not a substitute for the expected anonymous HTTP 401. No customer account was impersonated or production credential printed.

## Remaining blockers

1. Correct the production connection URL's prohibited SSL parameters and verify authenticated, certificate-validated TLS connectivity.
2. Make approved private database access available for inspection, migrations 001–003, administrator provisioning and the real draft import; verify existing state before each mutation.
3. Configure the approved `PUBLIC_SITE_URL` and verify production/staging secret isolation; environment writes currently return HTTP 403 with the available Netlify API access.
4. Complete production admin, schema, disabled-checkout, tracking, evidence/privacy and maintenance verification once connectivity works.
5. Supply verified physical stock, publish selected products, verify the exact Pochi payee/account, perform an authorized live reconciliation and obtain explicit owner launch approval.

## Required owner actions

Use Netlify environment administration to correct the private URL and set `PUBLIC_SITE_URL=https://herb-all.netlify.app` for production Builds and Functions. Preserve checkout false, production mode, verified TLS and the existing order-token secret. Provide the approved database URL through private local/runtime configuration and grant appropriate environment-write access if further assisted configuration is desired. Do not paste secrets in chat. Separate production credentials from development/previews, then rebuild the existing project.

Provide actual stock counts and the exact verified M-Pesa payee. Choose administrator passwords through the existing hidden/protected flows when provisioning becomes possible. Keep payments and customer checkout closed until live technical checks, authorized reconciliation and explicit launch approval are complete.

## Git

The audit began on clean `main` at `d30162e54e90007e2bc801d483a00f5e46a6b015`. Documentation is isolated on `docs/production-audit-2026-10-11` for PR review and CI before integration. No environment files, raw logs, database files, credentials, screenshots or browser artifacts are included. Final commit/PR/deployment identity and working-tree state are reported in the final response.
