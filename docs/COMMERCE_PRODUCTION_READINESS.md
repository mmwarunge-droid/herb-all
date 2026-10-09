# Commerce production readiness — 2026-10-09

This pass reviews PR #3 on `feat/commerce-inventory`, starting from `9527062`. Source implementation, production configuration and production verification are separate. No merge, production database connection, production administrator, real payment/refund or mail send is authorized/performed by this pass.

## Readiness and changes

**READY TO MERGE.** The source release is safe to review/merge with checkout and payments closed by default. This is not approval to merge and is not a claim of working production commerce. Deploying operational commerce still requires the owner inputs and launch verification below.

The existing architecture is retained. Added a default-off `COMMERCE_CHECKOUT_ENABLED` order-creation gate, requiring a configured order-token secret. Missing/false/malformed values refuse checkout before stock reservation. Cart/checkout explain closure; administration and existing-order tracking/reconciliation continue. Pochi has its separate disabled-by-default database setting; enablement requires complete details and literal `confirmed: true` from an authorized Super session.

Migration failures now print a sanitized operational message, never raw connection errors; successful migration names are printed only after commit. APIs include `X-Robots-Tag: noindex`. Documentation removes contradictory static-only/no-commerce/new-repository guidance, clarifies existing-project deployment and records an explicit gated launch procedure.

Repository-wide source/documentation searches found **no stale HRMIS project paths and no incorrect `Mureu` founder spelling**. All tracked instructions use repository-relative paths. Original photograph filenames containing a supplied title are preserved as source identifiers; public founder copy remains **David Muriu Warunge**, without an unverified title.

## Environment-variable inventory

| Variable                                                                 | Classification/scope                       | Configuration                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                           | Required private Functions/operational     | Approved pooled PostgreSQL URL; migration tools use an authorized migration role. Never browser-prefixed.                                                                                                                                          |
| `DATABASE_SSL`                                                           | Required private production runtime        | `true`; verifies remote TLS certificates. Avoid URL SSL flags overriding the explicit configuration.                                                                                                                                               |
| `APP_ENV`                                                                | Required private runtime mode              | `production`; only isolated local tests use `development`.                                                                                                                                                                                         |
| `ORDER_TOKEN_SECRET`                                                     | Required private core checkout security    | Stable random value, at least 32 characters; generation command is in `.env.example`. This derives private retry tracking keys. Session/recovery tokens are independently random and hashed, not signed with a separate invented session variable. |
| `COMMERCE_CHECKOUT_ENABLED`                                              | Required explicit runtime launch decision  | Defaults closed; literal `true` plus a valid order secret opens order creation. Keep `false` until launch/test-window approval. Separate preview/staging context.                                                                                  |
| `PUBLIC_SITE_URL`                                                        | Required safe public build/runtime origin  | Owner-confirmed HTTPS domain; no `.example` or localhost production origin. Used for canonicals and origin validation.                                                                                                                             |
| `PUBLIC_BUSINESS_EMAIL`, `PUBLIC_PHONE_NUMBER`, `PUBLIC_WHATSAPP_NUMBER` | Optional public build/contact              | Owner-approved contact overrides. They are not payment configuration.                                                                                                                                                                              |
| `PUBLIC_INSTAGRAM_URL`, `PUBLIC_FACEBOOK_URL`                            | Optional public build                      | Approved public profile links.                                                                                                                                                                                                                     |
| `PUBLIC_ENABLE_NETLIFY_FORM`                                             | Optional public build                      | Default false; enable only after form detection/privacy/delivery verification.                                                                                                                                                                     |
| `GOOGLE_ROUTES_API_KEY`                                                  | Optional private runtime                   | Provider-restricted server credential; absent/error means manual quotations.                                                                                                                                                                       |
| `FARM_LATITUDE`, `FARM_LONGITUDE`                                        | Optional server origin configuration       | Owner-verified coordinates, paired with Routes; none invented.                                                                                                                                                                                     |
| `RESEND_API_KEY`                                                         | Optional private runtime                   | Verified provider access, only if notifications are enabled.                                                                                                                                                                                       |
| `NOTIFICATION_FROM`, `ADMIN_NOTIFICATION_EMAIL`                          | Optional server notification configuration | Verified sender and approved recipient. Test environments must not send to customers.                                                                                                                                                              |

Pochi `payee`, `pochi_phone`, `payment_instructions` and `payment_enabled` are **database business settings**, not environment variables. Complete owner-verified details and explicit Super confirmation are required before enabling. No real payee/number/account/till was supplied or fabricated. `.env.example` contains blanks/safe placeholders and a closed switch, never usable secrets.

`PORT` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` are local preview/test overrides; `ASTRO_TELEMETRY_DISABLED` is a build-tool privacy option. They are not core commerce credentials. Node is 22.12+; `NODE_VERSION=22` is the existing Netlify build selector.

## Security findings

- Authorization is mandatory on product/image/stock, order/quotation/dispatch, payment/refund and staff/role routes. Session CSRF, exact-origin JSON controls and current permissions are checked before cached admin-operation responses. Role change/disable revokes sessions; a concurrent-safe guard retains the last Super.
- Initial provisioning is an operational TTY command, unavailable through public website routes. Passwords are silently entered, scrypt-hashed with per-password salt and never persisted plaintext. Existing administrators prevent repeat bootstrap. Production cookies are Secure/HttpOnly/SameSite=Strict; recovery is one-time and revokes sessions.
- Receipt submission only creates private pending evidence. Authorized verification records actual independently received funds once, with a reason and confirmation. Globally unique references, locked order/payment rows and operation receipts prevent retry-based duplicate effects. Actual overpayments are deliberately recorded in full and shown as refundable surplus, not hidden or credited twice.
- Late balance evidence/verification preserves preparing/dispatched states. Cancellation reconciliation records late confirmed funds as refund-pending without re-reserving stock. External refunds require actual-completion confirmation, recorded reference/reason and a bounded verified amount; repeated keyed writes cannot apply twice.
- Stable product-row locks, transactional checkout, stock/reserved constraints and immutable line snapshots prevent overselling or client price/stock manipulation. Failed checkout rolls back all reservations; expiry/cancellation releases once. Pending evidence is held for staff reconciliation.
- Order access requires unpredictable 256-bit private credentials bound to the order, plus a random reference. Lookup writes have persisted rate limiting; error messages do not disclose SQL/internal IDs. Private pages are noindex and API responses no-store/noindex. Private receipt bytes require Payments/Super even when an asset ID is known.
- Uploads accept bounded JPEG/PNG/WebP, decode with a pixel limit, strip metadata and re-encode WebP. Filenames are never used as paths; executable/oversized/invalid content is rejected. Public product and private receipt access remain distinct.
- Searches distinguish legitimate isolated test fixtures/CI credentials from production values. Database/provider secrets remain in private server configuration. No real secret, live payment account, demo sale inventory or production seed was introduced. PostgreSQL bytea storage and held-evidence/outbox backlogs still need operational monitoring. No MFA, load-test certification or automated provider payment verification is claimed.

## First authorized low-value payment reconciliation

This is a future production checklist, **not permission to execute a real payment**. Require approved production access, designated customer/staff accounts, a legitimate low-value product/order, actual stock/price, verified Pochi details and explicit owner authorization for the transaction/test window. Back up and record private baseline financial/stock values. Do not impersonate customers or fabricate evidence.

1. Open the approved checkout test window and create the legitimate order. Confirm exactly one order and reservation, correct server price, and merchandise deposit `ceil(subtotal_cents / 2)`.
2. Confirm stock and a separate transport quotation; verify transport payment timing and remaining merchandise balance. Do not add transport into the 50% merchandise calculation.
3. Verify that the customer sees the actual approved Pochi payee/phone/instructions. Independently confirm those in the payment provider before sending anything.
4. With explicit transaction authorization, customer sends the agreed low-value amount outside the website and submits the real receipt reference/amount/date/phone (optional private image).
5. Confirm evidence is pending and verified-paid amount remains unchanged. Confirm anonymous/unauthorized staff cannot retrieve the image or verify funds.
6. Payments/Super independently checks the actual business account and records the received amount once, with confirmation, reason and verifier identity. Inspect payment/history/audit values and remaining balance.
7. Repeat the same submission/reference and the same keyed verification safely; confirm no second credit, no duplicate reservation and no stock change. A reference reused against another order must be rejected. Do not perform a second provider transfer for this replay.
8. Prepare/dispatch under the agreed policy. Confirm physical/reserved reduction occurs once and dispatch metadata/audit is recorded. A post-dispatch balance scenario requires approved delivery-balance terms; default before-dispatch terms must settle the required balance first.
9. If authorized, settle the remaining agreed delivery balance outside the website, submit its evidence and verify independently. Confirm the order remains dispatched, totals update once, and delivery completion requires settlement.
10. Reconcile provider receipts, verified payments, refunds (if any), order snapshots, merchandise/transport/balance figures, stock movements and audit history. Record any legitimate surplus as refundable; never alter values to manufacture a pass.
11. Close the test window if any check fails, inspect any other orders admitted, disable payment instructions if the account is uncertain, and reconcile actual funds/stock. Approve launch only after all gates pass. A refund requires separate authorization and actual external execution before recording it.

## Validation evidence and external release gates

All checks below were executed successfully during this readiness pass:

| Check                                                        | Actual result                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `npm run check`                                              | 66 files; zero errors, warnings or hints                                                           |
| `npm run build`                                              | 47 pages; sitemap postbuild succeeded                                                              |
| `npm run test`                                               | 3/3 passed                                                                                         |
| `npm run format:check` and `git diff --check`                | Passed                                                                                             |
| `npm run test:commerce`                                      | 30/30 passed on isolated PostgreSQL 16                                                             |
| `npm run test:commerce:browser`                              | 4/4 passed                                                                                         |
| `npm run test:browser`                                       | 10/10 passed                                                                                       |
| `npm run db:migrate` on fresh isolated database, then repeat | 001 then 002 applied; repeat no-op; zero seeded products/admins, empty settings                    |
| `npm run admin:create -- <synthetic-email>` with TTY         | Password not echoed; one scrypt-hashed Super; repeat bootstrap rejected; no plaintext persisted    |
| Official Netlify function packaging                          | Commerce and maintenance package, API v2, native Sharp; no unresolved dependencies/errors/warnings |
| Existing hosted preview, read-only                           | Shop 200; products API 503 with only a sanitized configuration message                             |

No unresolved test failures occurred in the final runs. The six new backend regressions cover the launch gate, full privileged-route role/CSRF denial matrix, literal payment confirmation, failed multi-item rollback, unconfigured API sanitization/noindex and migration-error sanitization. The fourth browser scenario verifies graceful preview failure and closed-checkout UI. Original purchase/verification/dispatch, privacy/uploads, duplicate financial effects and stock-concurrency tests were rerun. Automated accessibility and responsive samples pass; no full accessibility certification or load testing is claimed.

Use the dedicated npm scripts. Test data stays in isolated PostgreSQL databases ending in `herb_all_test`; no production credentials are available or used.

Official Netlify packaging uses the same `@netlify/zip-it-and-ship-it` tool as the prior pass with Node 22, external Sharp, source `netlify/functions` and a temporary output directory. That temporary QA dependency/output is not committed. Generated manifests may include the packaging workspace; source/imports/configuration have no deployment-time absolute local filesystem dependency.

The existing preview at `deploy-preview-3--herb-all.netlify.app` is read only during this pass. A shop-shell 200 plus sanitized API 503 demonstrates graceful unconfigured behavior, not working hosted checkout. No database-backed production checkout, scheduler, actual provider transfer/refund, Google success request or notification delivery is certified. A preview database is optional; use an isolated one if full preview-commerce validation is required.

Remaining owner inputs: authorized existing Netlify access and confirmation of its `main` production branch; production PostgreSQL URL/TLS/runtime and migration permissions; stable order-token secret; approved first administrator email; actual HTTPS domain; real catalogue/prices/stock/images; verified Pochi payee/phone/instructions; explicit production test/launch authorization. Optional: owner-confirmed farm coordinates/Routes key, Resend verified sender/key/recipient and Netlify Forms verification. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for the exact gated sequence. No PR merge is performed without explicit authorization.

## Files changed in this readiness pass

- `.env.example`
- `README.md`
- `docs/COMMERCE_IMPLEMENTATION_REPORT.md`
- `docs/COMMERCE_OPERATIONS.md`
- `docs/COMMERCE_PRODUCTION_READINESS.md`
- `docs/DEPLOYMENT.md`
- `playwright.commerce.config.ts`
- `server/api.mjs`
- `server/commerce.mjs`
- `server/core.mjs`
- `server/migrate.mjs`
- `src/scripts/storefront.ts`
- `tests/commerce-browser/commerce.spec.ts`
- `tests/commerce/workflow.test.mjs`

No existing migration, inventory initialization, brand image, founder biography, production credential, provider account or unrelated project was altered.
