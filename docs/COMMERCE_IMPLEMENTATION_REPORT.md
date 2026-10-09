# Herb-All commerce implementation — 2026-10-09

Implemented in the existing Astro repository on `feat/commerce-inventory`. This is a locally validated implementation and release preparation, not a deployed or production-certified store. The existing Netlify configuration is retained. No production database, authenticated Netlify project, verified Pochi account or farm coordinates were available; no deployment, real payment, external refund or customer email was initiated.

## Implemented customer and administrator workflows

The database-backed `/shop/` has search, categories, sorting, pagination, product details/galleries, availability and quantity limits. `/cart/` supports multiple products, quantity changes/removal and browser persistence; the server reprices every quote and checkout. `/checkout/` accepts guest contact and written delivery details, with optional administrator-enabled farm collection. `/order/` provides private-key tracking, financial breakdown, timeline and pending M-Pesa evidence submission. The merchandise deposit is 50%, calculated in integer cents on the server and rounded upward to a cent. Transport remains separate and unknown until the administrator confirms it.

`/admin/` provides authenticated, role-authorized dashboard, product/gallery management, stock controls and movement history, order search/review, stock confirmation, transport quotations, communication records, preparation/dispatch/delivery, payment verification, external refund recording, business configuration and staff account/role management. Super, Inventory, Orders and Payments roles are checked on the server. Role changes and disablement revoke sessions; the last active super administrator cannot be removed. No default production administrator or fake sale inventory is seeded.

Checkout reserves stock transactionally with stable row-lock ordering. Available stock excludes reservations. Dispatch consumes physical and reserved balances exactly once; cancellation/expiry releases reservations exactly once. Historical line prices and descriptions remain snapshots. Pending payment evidence does not credit an order and holds unpaid-expiry release until staff reconcile it. Existing evidence can be verified after cancellation solely to account for and refund actual received funds without reopening stock or fulfillment. Actual overpayments are recorded and separately refundable.

Existing founder/gardens/educational content and supplied photographs are retained. The public founder name remains **David Muriu Warunge**, without an unverified title. Homepage/navigation/contact copy now links to the shop, and privacy/terms explain the added commerce workflow while retaining their owner-review notices.

## Key files and database changes

| Area                                                 | Files                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Persistent schema                                    | `migrations/001_commerce.sql`, `002_operation_idempotency.sql`                                                                        |
| Transactions, authentication, inventory and payments | `server/db.mjs`, `core.mjs`, `commerce.mjs`, `api.mjs`                                                                                |
| Migration/provisioning/recovery tools                | `server/migrate.mjs`, `cli.mjs`                                                                                                       |
| Optional notifications and local preview             | `server/notifications.mjs`, `local.mjs`                                                                                               |
| Existing-host functions and maintenance              | `netlify/functions/commerce.mjs`, `maintenance.mjs`, `netlify.toml`                                                                   |
| Customer/admin pages and scripts                     | `src/pages/shop/`, `cart.astro`, `checkout.astro`, `order.astro`, `admin/`, `src/scripts/`, `src/components/CommerceShell.astro`      |
| Integration and presentation                         | `BaseLayout.astro`, homepage/contact/privacy/terms, `global.css`, sitemap configuration                                               |
| Validation                                           | `tests/commerce/`, `tests/commerce-browser/`, `playwright.commerce.config.ts`, existing build tests, `.github/workflows/commerce.yml` |
| Configuration and instructions                       | `.env.example`, `README.md`, `docs/COMMERCE_PLAN.md`, `COMMERCE_OPERATIONS.md`, `DEPLOYMENT.md`                                       |

Migration 001 adds administrators, hashed sessions/recovery, rate limits, settings, categories/products/media, orders/line snapshots, inventory movements, submitted payments, history, audits and durable notification outbox. Migration 002 adds idempotent administrator-operation receipts. `npm run db:migrate` applies unapplied migrations transactionally under an advisory lock, records checksums and refuses edited applied migrations. Both migrations and a second no-op application were exercised on isolated PostgreSQL 16. Production PostgreSQL/provider configuration has not been exercised.

## Operator instructions

Use Node 22.12+, install with `npm ci`, copy `.env.example` to private `.env`, and configure the target `DATABASE_URL`, verified TLS, exact `PUBLIC_SITE_URL`, production mode and stable random `ORDER_TOKEN_SECRET`. Then:

```sh
npm run db:migrate
npm run admin:create -- <authorized-owner-email>
```

The provisioning CLI asks for a password silently in the terminal; it does not accept passwords in command arguments. Bootstrap works only when no administrator exists. After deployment, sign in at `https://<actual-site>/admin/`. Operator-controlled one-time recovery is documented in [COMMERCE_OPERATIONS.md](COMMERCE_OPERATIONS.md); no public unauthenticated administrator creation/reset endpoint exists.

David can create products under **Products & stock**, enter actual prices/units/SKUs/quantity bounds, upload accurate photographs, adjust total physical stock with a reason and publish. Each variety/size can have its own SKU/stock. Archiving retains history; available units equal physical minus reserved.

Under **Business settings**, independently verify the real Pochi payee/phone/instructions before explicitly enabling payments. The known public contact phone is not assumed to be a payment account. Customers follow the configured instructions outside the site and submit their transaction reference, amount, phone/date and optional private receipt. **Payment queue** verification requires a Payments/Super administrator to check the actual business account, enter the received amount and confirm it with an audit reason. Submission alone never credits payment. Refund controls record an already-completed external refund; the website never initiates provider transfers or refunds.

Orders/Super confirms stock and a separate transport quotation. Optional private Google Routes credentials and owner-confirmed farm coordinates enable a road-distance estimate from the written destination; distance never sets the price. Missing/provider-error cases use manual address review and quotations. No interactive map picker or invented farm location is present. Optional Resend notifications use a persisted, bounded retry outbox; orders and tracking remain functional without notifications.

## Validation and limitations

- `npm run check`: 66 files, zero errors/warnings/hints.
- `npm run build`: 47 pages successfully generated; sitemap postbuild succeeded.
- `npm run test`: all 3 existing build/content/image-integrity tests passed.
- `npm run format:check`: passed.
- `npm run test:commerce`: all 24 PostgreSQL-backed tests passed, including cancelled-evidence reconciliation.
- `npm run test:commerce:browser`: all 3 scenarios passed, including staff role changes and session revocation.
- `npm run test:browser`: all 10 original browser scenarios passed, including existing content/navigation/images and responsive/accessibility checks.
- Official Netlify function packaging exercised both functions, including native Sharp dependencies, API routing and scheduled-function configuration; no packaging errors or warnings.

Backend tests cover server pricing/deposit rounding, concurrent final-item orders, checkout/admin retry idempotency, expiry and stock consistency, manual verification and duplicate references, partial payments, cancellation/refunds/overpayments, delayed evidence, authentication/roles/CSRF/recovery/rate limits/privacy, secure uploads, external-service failure fallbacks and notification isolation/retries. Browser tests use the real local API/PostgreSQL, isolated test administrators/inventory/payment configuration, and cover the complete mobile purchase-to-dispatch journey, cart persistence/empty/filter states, role management and responsive axe checks. Fake fixture prices/payee/receipt references exist only in test files/test database.

Development failures included client cart timing/blur behavior, initial rate-limit SQL parameter handling, private-media error propagation, and reconciliation-test column names. These were corrected and the affected suites rerun. Logs, screenshots, test database files and packaged QA functions are not committed. Browser accessibility checks are automated samples, not full accessibility certification. No load test, production database rehearsal, live Google success request, real Pochi transfer/refund, Resend delivery or production end-to-end purchase is certified.

## Security and release status

Passwords use scrypt; random session/recovery/tracking tokens are hashed. Production sessions use Secure/HttpOnly/SameSite cookies, server-side expiry and revocation. Writes enforce origin/JSON controls, administrator CSRF, authorization and idempotency. Customer tracking requires a private key, not merely a public reference/phone. SQL uses parameters and transactions. Uploads are bounded raster images, re-encoded without metadata, with payment receipts private to authorized staff. Remote database TLS verifies certificates. Monetary, stock, fulfillment and receipt invariants are enforced on the server and audited. Internal notes are not sent to customer notification recipients.

The CI workflow validates against isolated PostgreSQL, never production. Preview environments must likewise have isolated databases/keys/mail recipients. Monitor database/media growth, pending evidence, held reservations, rate limits, maintenance jobs and notification backlog. Use a restricted runtime database role, backups/PITR, staged migrations and provider controls. Password MFA, automated provider verification and object-storage receipt/gallery migration are not implemented; they are future improvements rather than claims about this release.

Required release work: identify the authorized existing Netlify project, provision staging/production PostgreSQL and private secrets, apply migrations, provision the first admin, configure approved real catalogue/stock/images and verified Pochi instructions, and validate HTTPS/API/auth/upload/scheduler/payment workflows in staging before production promotion. Farm coordinates/Routes credentials and Resend credentials are optional; manual quotes and tracking work without them. Review legal text and recovery/retention policy with the owner. Deploy only through the existing authorized hosting project, preserve the database for rollback, and record live checks before accepting customer payments.

The implementation is reviewable in Git; no claim is made that branch builds, payment enablement or hosting deployment have occurred until separately verified.
