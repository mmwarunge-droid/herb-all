# Product imagery and navigation upgrade — 2026-10-14

This is a presentation-only change. No production database writes, imports, product publication, stock changes, payment changes or checkout enablement are part of this task. Founder name remains David Muriu Warunge. The 63 imported products stay subject to their existing publication and launch gates.

## Imagery

All 63 SKU keys have centralized image mappings: 61 use external representative photos, Moringa retains the supplied Herb-All photo, and Apple-to-Loquat uses a clearly generic supplied garden photo until its graft combination and photography are confirmed. The six herbal product profiles and five existing seedling profiles receive representative imagery; the supplied moringa seedling profile remains unchanged. The owner confirmed Gooseberry means Cape gooseberry, Physalis peruviana.

48 distinct Wikimedia Commons source images produce 140 locally hosted responsive WebP files. Licenses: public domain, CC0, CC BY 2.0/2.5/3.0/3.0 US/4.0 and CC BY-SA 2.5/3.0/4.0. 37 source images require attribution. All source pages and current license declarations were rechecked on October 14. Required credits, source/license links and modification notices are visible on /image-credits/ and linked from representative captions. No third-party hotlinks appear in product rendering.

See [the complete inventory](TEMPORARY_PRODUCT_IMAGES.md) for product mappings, original/download URLs, creators, checked dates, derivative paths and replacement workflow. Source checksums pin downloads. Large inputs remain in an external temporary cache. Uploaded administrator media automatically takes precedence. Unmapped products or failed image loads show a botanical placeholder with the product name; broken icons are hidden. Portrait photos retain their full framing. Clickable card images and detail routes are preserved.

## Navigation

Desktop primary links: Home, Shop, Seedlings, Gardens, Learn, About. Right-side actions: Cart with live accessible count, Enquire. More contains Herbal Products, Farm visits, Track an order, Terms, Privacy, Disclaimer and Image credits. Nested routes inherit the parent active state.

Below 1180px a native dialog drawer supplies navigation, secondary links and enquiries. It manages focus, wraps Tab/Shift+Tab, closes on Escape/backdrop/Close, restores the opener and releases scroll locking. Cart stays available outside the drawer. A native disclosure menu works without JavaScript. The existing catalogue filters remain; no permanent site-wide sidebar was added.

## Validation

- Astro: 76 files, zero errors/warnings/hints.
- Build: 48 static pages; build tests: 4 passed.
- Formatting and diff checks pass.
- Original browser tests: 10 passed; focused navigation/image tests: 7 passed.
- Automated accessibility: zero WCAG A/AA violations across 14 original route scans and desktop More/mobile drawer states and a populated cart badge.
- Responsive routes pass at 320, 375, 768, 1024 and 1440px, with no overflow, failed main images or page exceptions.
- Isolated PostgreSQL commerce backend: 37 passed; commerce browser: 5 passed. Original commerce assertions/selectors were retained.
- All mapped src/srcset assets exist; unreferenced temporary assets are rejected by the build test.
- The first drawer test exposed native Chromium focus cycling through browser chrome; an explicit Tab wrap corrected it. CI subsequently caught inherited white text on the pale populated-cart badge; an explicit dark color and a positive-count accessibility check corrected it. Final suites pass.

Functions/server/migrations are unchanged, so no additional Functions packaging was needed. Production publication and financial behavior were not exercised or changed for this visual task.

## Performance

No Lighthouse before/after comparison was measured. External derivatives total 9,537,054 bytes across all sizes; the smallest variant averages 25,551 bytes per source. Images have dimensions, responsive srcset/sizes and lazy loading except primary detail images. Navigation uses vanilla JavaScript and native HTML controls; no menu framework or carousel library was added.

## Changed files

- package.json
- src/components/Card.astro
- src/components/Navigation.astro
- src/components/ProductVisual.astro
- src/layouts/BaseLayout.astro
- src/pages/products/[slug].astro
- src/pages/seedlings/[slug].astro
- src/pages/image-credits.astro
- src/scripts/cart-count.ts
- src/scripts/navigation.ts
- src/scripts/product-images.ts
- src/scripts/storefront.ts
- src/utils/product-images.ts
- src/config/temporary-product-images.json
- src/styles/global.css
- scripts/temporary-image-sources.json
- scripts/optimize-temporary-images.mjs
- scripts/document-temporary-images.mjs
- docs/TEMPORARY_PRODUCT_IMAGES.md
- docs/IMAGERY_NAVIGATION_UPGRADE.md
- tests/build.test.mjs
- tests/browser/navigation-images.spec.ts
- public/images/products/temporary/: all 140 WebP paths are enumerated in the image inventory and manifest.

## Hosted verification

On October 14, Netlify reported the existing site as disabled and no deployment preview for this branch was created. The public site returned 503; the last published application commit remained 3e2945b21a545ea535bf418a8ceb3c5fbeab30f4. Hosting configuration was not changed by this task. Local validation is complete; hosted visual verification awaits restoration of the existing site and a feature preview.

## Remaining work

Restore the existing Netlify site if its disabled state is not intentional, then verify a hosted feature preview. Replace representative photos with confirmed Herb-All product photography when available. Confirm the Apple-to-Loquat graft identity/photo before substituting a specific plant image. Opening checkout remains a separate owner-controlled task.
