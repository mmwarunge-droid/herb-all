# Verification — 2026-10-07

- Dependencies installed; final audit: zero reported vulnerabilities.
- Astro/type checks: zero errors, warnings or hints.
- Production build: 41 static HTML pages, plus robots, RSS and generated sitemap indexes/chunks. `/sitemap.xml` is an alias of the generated sitemap index.
- Two build checks pass: unique metadata/canonicals, one h1, alt text, valid JSON-LD, local link/asset targets, collection routes, feeds and no retained locale/template routes.
- Ten browser tests pass. Twelve representative routes checked at 320, 375, 768, 1024 and 1440 pixels: no horizontal overflow, broken loaded images or JavaScript exceptions. Product/seedling/article filters, combined criteria, reset, no-result state and query persistence pass. Mobile menu, keyboard skip link, no-JS catalogue and accessible image fallback pass.
- Automated axe WCAG A/AA checks on those twelve routes: zero violations. This is not a claim of exhaustive manual WCAG conformance.
- Lighthouse local production homepage (mobile default): Performance 100, Accessibility 100, Best Practices 100, SEO 100. One local run, not a hosted performance guarantee or a score for every page.
- Development and production preview commands start and serve the finished site. Desktop/mobile screenshots inspected; artifacts kept outside the repository.
- Temporary configured build verifies domain canonical/social links, email, telephone, WhatsApp and item-aware enquiries.
- Optional Netlify Forms build verifies native POST, form name, honeypot, item propagation and confirmation path. A browser test removed Netlify’s detection attribute and intercepted the POST locally; no email/provider message was sent. Real delivery requires owner verification on Netlify.
- No production service, HRMIS source, Dundaa source or customer data changed. No secrets, screenshots, logs or QA fixture builds included in site source.

## Launch boundaries

Domain and business/contact/social values are placeholders. Catalogue images and content are explicitly illustrative; six products, six seedlings and six articles require owner/editorial review. Legal starter pages require review. No live GitHub repository or Netlify deployment was created; those require the owner’s accounts. No real stock, medicinal claims, exact yields, prices, customer accounts or payment flows were fabricated.

## Reproduce

```sh
npm install
npm run check
npm run build
npm run test
npx playwright install chromium
npm run test:browser
npm run format:check
```

The original upstream commit and removal decisions are recorded in STARTER.md. Image sources and license are in IMAGES.md. The dependency lockfile pins the verified installation.
