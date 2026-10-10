# Herb-All commerce operations

## Architecture and setup

The existing Astro site remains static. Same-origin `/api/*` requests run through Netlify Functions with PostgreSQL persistence. Netlify is still the configured hosting provider; initial repository deployment metadata contained no live deployment records. After the review branch was pushed, the existing Netlify integration identified project `herb-all` and automatically built deploy preview 3; its API returns a sanitized configuration error until a separate preview database is configured. Customer shopping shells are `/shop/`, `/cart/`, `/checkout/`, `/order/`; administration is `/admin/`. No production products are seeded. The original educational sample catalogues are preserved and are separate from sale inventory.

Use Node 22.12+. Run these operational commands from the repository root; neither provisioning nor migrations run during a Netlify source build.

```sh
npm ci
cp .env.example .env
# Supply the target database, stable random order-token secret and actual public URL privately.
npm run db:migrate
npm run admin:create -- owner@example.test
npm run build
npm run preview:commerce
```

Replace the example email with the authorized initial administrator’s address. The CLI reads a new password silently from the terminal; it is never placed in command arguments or logged. Bootstrap only works when no administrator exists. It uses a PostgreSQL admission lock to prevent simultaneous bootstrap. In production, log in over HTTPS at `/admin/`. Local commerce testing also requires `COMMERCE_CHECKOUT_ENABLED=true`. Local preview requires `APP_ENV=development`, `PUBLIC_SITE_URL=http://127.0.0.1:4321` and a local PostgreSQL connection; never set development mode for deployed functions.

`npm run admin:recover -- <administrator-email>` issues a private one-time token valid for 30 minutes. Deliver it through a trusted channel and use the recovery form at `/admin/` to choose a new password. Token use revokes existing sessions. This is controlled deployment-operator recovery, not an unauthenticated public account reset. Super administrators create authorized staff through Accounts using an administrator-chosen password; changing a role or disabling an account revokes its sessions. Other accounts can be reassigned through the Accounts screen; concurrent changes cannot remove the last active super administrator. Roles are Super, Inventory, Orders and Payments. UI visibility supplements mandatory server authorization.

## Migrations and storage

`001_commerce.sql` adds administrators, sessions/recovery, rate limits, business settings, categories, products/media, orders/line snapshots, inventory movements, payment submissions, history, audits and the notification outbox. Reservations are represented by order line quantities and order inventory state, with product reserved balances updated transactionally. Variants use independent product SKUs and a variant description, so each size/variety has independent pricing/stock.

`002_operation_idempotency.sql` adds immutable responses for retried authorized writes. `npm run db:migrate` runs unapplied migrations inside a transaction under an advisory lock; recorded checksums prevent edited applied migrations. Existing records are never deleted by migrations. Apply with a migration-capable database role before deploying the functions. Use a restricted runtime role with table access but no schema-changing permissions. Retain managed database backups/PITR and verify recovery separately before accepting customer orders.

All money is integer KES cents. Inputs permit at most two decimal places; the delivery 50% deposit rounds upward to the nearest cent (`ceil(merchandise_cents / 2)`). Line names, SKUs, variants, units and prices are immutable snapshots. Approved adjustments are separately recorded; transport is nullable until explicitly quoted. Verified payments and completed external refunds are separate values/records. No provider payments or refunds are executed by the website.

Uploaded JPEG/PNG/WebP images are limited to 2 MB and 20 megapixels, re-encoded as WebP, stripped of metadata and stored as PostgreSQL bytea. Product galleries permit eight images. Payment receipts require a Payments/Super session to retrieve and are never publicly addressed in customer responses. There is no ephemeral filesystem dependency. Database size/backup cost should be monitored as galleries grow; an authenticated object-storage adapter can replace bytea later.

## Product and stock management

1. Inventory/Super → Products & stock → Create product. Enter name, unique slug/SKU, category, unit, real price, description, quantity bounds and optional variant/handling notes.
2. Upload accurate product photographs with descriptive alt text. If none exists, the shop displays an explicit photograph-pending fallback, not unrelated stock imagery.
3. Edit the product → Adjust stock. Enter total physical stock including reserved units and a reason. Available-to-sell is physical minus reserved. Changes below reserved quantity are rejected.
4. Publish when ready. Unavailable, draft and archived products cannot be purchased. Archiving retains historical order references. Use search and pagination to find a product by name/SKU. Separate SKUs represent optional varieties or sizes.

Checkout locks product rows in a stable order, reprices on the server and reserves stock atomically. Stock is physical until dispatch; dispatch reduces physical and reserved units together. Cancellation/expiry releases only active reservations, once. Default unpaid hold is 48 hours, adjustable 1–168 hours in Business settings. Paid reservations are not automatically expired. Pending/clarification payment evidence holds inventory beyond the unpaid deadline until staff reconcile it; inspect that queue promptly, including allegedly paid orders. Rejected unpaid evidence is eligible for normal expiry. Do not reject evidence just to recover stock without checking for actual funds.

Published Netlify maintenance runs every 15 minutes, expires unpaid reservations and attempts notification delivery. Storefront/cart/tracking/admin reads also review expiry. `npm run reservations:expire` is a controlled fallback. These operations are bounded per invocation and safely repeatable; monitor scheduled-function health and backlog.

## Order, quotation and payment workflow

1. Customer shops, selects multiple quantities and checks the server quote. The cart persists product IDs/quantities in browser local storage, never authoritative prices.
2. Guest checkout collects contact/destination data; farm collection is available only if enabled. The server creates a random public reference and reserves stock. The customer receives a private tracking key. Save/copy it; it is required alongside the reference on another device. A phone number alone does not grant access.
3. Orders/Super opens the order and confirms stock. For delivery, enter the final transport quotation, payment policy and notes. Collection has zero transport. Quotations/merchandise adjustments can be revised only before any payment evidence; each change is recorded.
4. Use Estimate road distance if configured. Google Routes receives the written destination and the owner-verified farm coordinates. Its result is a road estimate, never a price. Missing credentials, invalid/quota/provider failures retain manual address review and manual quotation. No farm coordinates or browser map picker were invented; manual address entry is always available. There is no Maps browser key/script in this release.
5. Super → Business settings independently verifies and enters the Pochi payee, payment phone and actual instructions, then explicitly enables payment. The public contact number is never assumed to be the payment account. Unconfigured orders show “do not pay yet”.
6. Once stock/terms/configuration are confirmed, customer tracking shows the delivery 50% merchandise deposit plus confirmed upfront transport, if applicable. Default merchandise balance is due before dispatch; optional delivery balance is explicit. Transport may be upfront or delivery, selected on the quotation. Unknown fees never enter the deposit. The customer follows the configured real Pochi instructions outside the website and checks the displayed payee in M-Pesa.
7. Customer submits transaction code, reported amount, payer phone, date/time and optional message/private receipt. This only creates pending evidence. Rejected/clarification evidence can be corrected using the same reference; the prior evidence and decision remain in history. No PIN or account password is required.
8. Payments/Super → Payment queue → review financials → independently check the business account. Verify the actual amount, reject with a reason or request clarification. Credits require an authorized verifier, confirmation and audit record. Receipt references are globally unique. Actual verified overpayments are recorded in full and shown separately as refundable surplus; refunding surplus preserves the active order and never lowers its agreed merchandise value. Partial verified payment remains awaiting additional payment; duplicate verification does not credit twice.
9. Orders/Super prepares delivery orders only after the verified deposit and confirmed terms. New farm collection orders can be prepared after stock confirmation without payment; full verified payment is required before collection handover. Existing orders retain their recorded deposit terms. Dispatch requires the order’s applicable payment conditions and recorded dispatch/collection details. For delivery-balance terms, later evidence/verification retains the dispatched status. Delivery completion requires the remaining balance to be verified.
10. Cancellation releases reserved inventory once; payments/uncertain evidence move to refund review, with no further payment requested on the cancelled order. Payments/Super records an actually completed external refund with reference/reason, confirmation and amount. The site does not initiate a refund. Reconcile rejected evidence and repeat cancellation when no actual funds need refunding. Already dispatched orders cannot be cancelled/restocked automatically.

Existing payment evidence can still be verified after cancellation when staff independently confirm actual received funds. This is accounting reconciliation only: the order enters refund-pending, stays closed to fulfillment and new customer payment submissions, and its released stock is not reserved again. Record the completed external refund after reconciling the receipt.

Orders support reference/customer/status/date search, private internal notes, financial/stock/status history and recorded communication channel/notes. The dashboard counts live inventory, order statuses and verification queue. Customer tracking contains a timeline and current amounts without requiring email/SMS.

## Notifications

Optional Resend sends events from a persisted outbox after order transactions commit. Set `RESEND_API_KEY`, a verified `NOTIFICATION_FROM`, and `ADMIN_NOTIFICATION_EMAIL`. Customer email is optional. Failures leave the order visible and the event retryable. Internal notes are not queued for customer emails. Provider idempotency keys reduce duplicate sends; automatic retries are capped at three within 23 hours, after which staff must inspect delivery before communicating manually. Scheduled invocations process two events to remain within the provider’s execution limit. A provider outage or long backlog needs operator attention; no exactly-once email delivery guarantee is made.

## Security and release configuration

- `DATABASE_URL`, `DATABASE_SSL=true`: use a pooled PostgreSQL URL and verified TLS. For remote databases, omit URL SSL flags and use the explicit setting; default CA validation remains enabled. Never disable certificate checks for production.
- `APP_ENV=production`: deployed sessions are Secure, HttpOnly, SameSite=Strict, expire after eight hours and store token hashes server-side. Origin + JSON checks protect writes; admin writes additionally require session CSRF and idempotency keys. Passwords use scrypt; recovery/session tokens are random and hashed.
- `COMMERCE_CHECKOUT_ENABLED=false`: explicit default-off order-creation switch. Only literal `true` with a configured order-token secret opens checkout. Cart and checkout explain a closed launch; direct API calls fail before reserving stock. Administration and existing-order tracking/reconciliation remain available. Disable payments separately in Business settings when required.
- `ORDER_TOKEN_SECRET`: a stable, randomly generated secret of at least 32 characters; use the generation command in `.env.example`. Rotating changes retry-token derivation; original customer tracking keys still match stored hashes. Plan retries/recovery before rotation.
- `PUBLIC_SITE_URL`: exact HTTPS production origin, configured separately for Builds and Functions scopes. Production builds can fall back to Netlify’s `URL`/`CONTEXT` metadata; this does not inject that origin into the runtime. TOML environment values do not configure Functions secrets. API errors never return traces, raw SQL, credentials or private payloads.
- `GOOGLE_ROUTES_API_KEY`, `FARM_LATITUDE`, `FARM_LONGITUDE`: optional owner-verified coordinates/key. Enable billing and Routes API; restrict the private key to that API and the deployment’s supported server-network controls. Google requests are time-limited. No browser key is needed without an interactive picker.
- Notification variables are optional and private. Keep deploy-preview database, keys and mail recipients isolated from production. Do not let branch previews write to the production database.

No production database, Netlify account/site ID or verified payment account was supplied at implementation. Repository deployment records were initially empty; subsequent PR checks identified the existing `herb-all` project and its automatic preview. No production release was attempted. The automatic preview serves the shop shell, but its unconfigured database returns a sanitized 503; do not point it at production data. Before live launch: configure staging database and runtime secrets, apply migrations, provision an admin, deploy through the existing Netlify project, verify `/api/*`, cookies, roles, uploads and scheduler, then conduct a designated-account/provider test and review logs. Keep `COMMERCE_CHECKOUT_ENABLED=false` until the designated launch window; use a separately configured staging environment with the switch enabled for pre-launch tests. Configure actual approved stock/prices/images and verified Pochi instructions; verify farm coordinates or retain manual quotes. Only then repeat the gates against production. Back up the database before migration and retain it during application rollback; do not drop commerce tables to roll back the UI.

See [production readiness and first-payment checklist](COMMERCE_PRODUCTION_READINESS.md) for the complete variable inventory, release sequence and authorization boundaries.

## Emergency shutdown and recovery

**Stop new orders:** set `COMMERCE_CHECKOUT_ENABLED=false` in the existing Netlify project’s **Production / Functions** environment, then publish a deployment/config refresh. A change in `.env`, a dashboard edit without the required deployment, or a TOML build variable alone does not establish that the live Functions changed. Confirm new checkout is refused, reserved-stock totals do not change, and existing private tracking/admin still work. Disabling checkout neither deletes pending orders nor releases their reservations. Existing order reconciliation remains available. To stop displaying payment instructions independently, Super → Business settings → disable payment; reconcile any funds received before/after the shutdown.

Do not blindly cancel allegedly paid orders to free stock. Inspect pending evidence and actual account receipts. Registered expiry only releases eligible unpaid reservations; actual received money needs authorized accounting/refund handling. Do not toggle the switch back on until the relevant launch gates pass.

**Backups:** before initial migrations, establish the actual provider’s durable backup/PITR policy, retention, authorized recovery operator and restore procedure. Record the latest available recovery point privately and make a backup before later migrations. Product/receipt bytes are in PostgreSQL, so recovery must include all commerce tables/media; a source rollback is not a database restore. No production backup provider or restore test is claimed by this guide.

**Restore:** hold new checkout, retain the original database, and restore to a separate recovery instance using the chosen provider’s supported procedure. Verify migration records, users, order snapshots, payments/refunds, reservations/physical stock, private receipt access and outbox state before changing service connections. Reconcile all provider funds, orders and uploads after the recovery point; never delete the original first or replay external money/refunds blindly. Publish the corrected connection configuration and verify the service before reopening. Avoid duplicate email delivery from a restored outbox; inspect provider delivery first.

**Credentials:** rotate the runtime database role through the provider and replace its private Production/Functions secret, then deploy the connection change and verify validated TLS/access before revoking the old credential. Retain a restricted runtime role and separate migration access. Never print URLs/passwords, expose them in process arguments, or commit them. Order-token secret rotation is a separate planned operation: existing supplied tracking keys still match stored hashes, while checkout-retry derivation uses the secret and changes on rotation. Keep checkout closed, retain private recovery materials and assess retries before rotating; do not assume it behaves like database-password rotation.

**Administrator recovery:** an authorized deployment operator runs `npm run admin:recover -- <approved-administrator-email>` against the correct private database configuration. Send its one-time token through a trusted channel, not a public issue/report. Use the `/admin/` recovery form within 30 minutes; a successful reset revokes existing sessions. Do not recreate Super accounts or weaken login to regain access.

## Provider references

[Netlify Functions](https://docs.netlify.com/build/functions/api/), [scheduled functions and limits](https://docs.netlify.com/build/functions/scheduled-functions/), [Google Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions), [node-postgres TLS](https://node-postgres.com/features/ssl), [Resend email API](https://resend.com/docs/api-reference/emails/send-email).

## Owner-approved setup

See [Approved business setup — 2026-10-10](APPROVED_BUSINESS_SETUP_2026-10-10.md) for the two approved administrator emails, the explicit 63-product draft import, confirmed Pochi number and delivery versus Rongai farm collection terms. The payee and physical stock counts still require verification; importing drafts does not open checkout.
