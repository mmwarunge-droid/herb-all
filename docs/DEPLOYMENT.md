# Deploy the existing Herb-All project

Use the existing `mmwarunge-droid/herb-all` repository and Netlify project `herb-all`. Do not replace either. PR #3 contains commerce; merging requires owner authorization and is not performed by the readiness pass. Verify the existing Netlify production branch is `main` in the authorized dashboard; repository configuration cannot prove that dashboard setting.

The Astro frontend is static, with same-origin `/api/*` Netlify Functions and PostgreSQL commerce. Static pages remain usable without a database. Preview commerce APIs deliberately return a sanitized 503 when their database is absent. A preview database is optional unless full hosted commerce testing is desired; if configured, use separate database, secrets and mail recipients, never production resources.

## Hosting and runtime

- Base directory: repository root containing `package.json`.
- Production branch: `main`, confirmed in the existing project's dashboard before release.
- Build: `npm run build`; publish: `dist`; functions: `netlify/functions`.
- Node: 22.12+ (Node 22 configured in `netlify.toml`). Native Sharp is packaged by Netlify's function tooling.
- Set public site/contact values for builds and private commerce variables for the Functions runtime. Use context-specific settings for deploy previews. Environment changes require a new applicable deployment; they do not alter an already-running artifact.
- Set the actual HTTPS `PUBLIC_SITE_URL` for canonical metadata and write-origin checks. Add/verify the domain and TLS through the existing project's controls.

Read [COMMERCE_OPERATIONS.md](COMMERCE_OPERATIONS.md) for database permissions/TLS, migrations, silent administrator provisioning, inventory/payment operations and recovery. [COMMERCE_PRODUCTION_READINESS.md](COMMERCE_PRODUCTION_READINESS.md) lists every variable and the first-payment checklist. No build creates a database, administrator, sale inventory or payment account.

## Gated production sequence

1. Obtain authorization to merge PR #3; review its passing checks and merge into `main`.
2. Deploy `main` through the existing Netlify integration with `COMMERCE_CHECKOUT_ENABLED=false` and payments disabled. This serves informational pages and a closed/unconfigured store, not operational commerce.
3. Configure the production PostgreSQL connection, validated TLS, exact HTTPS origin, production mode and stable order-token secret in private runtime settings. Keep the checkout switch false; rebuild/redeploy the applicable configuration. Confirm the project's production branch and preview isolation.
4. Back up the target database, then run `npm run db:migrate` from the repository root using an authorized migration role. It applies `001_commerce.sql` then `002_operation_idempotency.sql`, records checksums and skips already-applied unchanged files. Run it again to verify the no-op result. Do not run migrations inside the source build or from a customer endpoint.
5. With an approved owner email, run `npm run admin:create -- <email>` in an interactive operational terminal. Enter a new password silently and log in over HTTPS. This only provisions the first administrator; subsequent staff are managed in the protected Accounts screen.
6. Enter approved real products, prices, stock and accurate images deliberately. Verify roles, uploads, empty states, tracking privacy and the maintenance scheduler. Use a dedicated staging database and enabled staging checkout to verify order creation/reservation before opening production.
7. Independently verify the real Pochi payee, phone and instructions. Configure them through Super → Business settings with literal account-confirmation consent. Keep payment instructions disabled until actual account verification is complete.
8. Arrange an explicitly authorized, designated-account production test window. Temporarily enabling checkout exposes the order-creation endpoint; this is not an account allowlist. Coordinate the window and reopen/close the environment switch through a deployment, inspect all orders received, and do not claim the gate isolates test users. Follow the first low-value reconciliation checklist only after separately authorizing the real payment.
9. Close checkout again if any gate fails, reconcile orders/stock/funds, and leave payments disabled when account details are uncertain. Accept customer-facing commerce only after infrastructure, catalogue, checkout and authorized payment reconciliation pass and the owner approves launch. Set `COMMERCE_CHECKOUT_ENABLED=true` and deploy the final approved configuration.

A production test window and customer launch must be deliberate operational decisions. The checkout switch does not cancel existing orders or block their tracking/reconciliation; payment settings independently control payment instructions. Application rollback retains the commerce database and financial history. Never drop commerce tables or reset inventory to roll back the UI.

## Validation

From the repository root: `npm ci`, `npm run check`, `npm run format:check`, `npm run build`, `npm run test`, then both browser suites. PostgreSQL commerce tests require an isolated migrated database ending in `herb_all_test`; they truncate test records. Run `npm run test:commerce`, `npm run test:commerce:browser` and `npm run test:browser` sequentially. Do not use production credentials or data. See readiness evidence for the official Netlify packaging command and actual results.

## Informational website checks and optional forms

Verify homepage, About, Gardens, educational product/seedling/article routes, images, contact channels, robots/sitemap/RSS, and legal/disclaimer copy alongside commerce. Public email/WhatsApp defaults are contact details, never inferred Pochi details. Review sample educational content independently of real sale inventory.

The default enquiry composer opens the visitor's email client; it does not send mail itself. Optional Netlify Forms requires form detection and `PUBLIC_ENABLE_NETLIFY_FORM=true`, rebuild, privacy/retention review and a designated-account submission test in the existing dashboard. See [Netlify Forms setup](https://docs.netlify.com/manage/forms/setup/). Keep it false until verified. Existing search-console instructions remain in `SEO.md`.
