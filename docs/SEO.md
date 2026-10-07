# Search discovery

Every page has a unique title and description, a canonical URL, Open Graph and Twitter metadata. Articles have BlogPosting markup, detail pages have breadcrumbs, products have catalogue Product markup without invented offers, and the site has Organization markup. No LocalBusiness or FAQ schema is emitted because no verified address or FAQ content was supplied. No tracking is installed.

## Set the real domain first

Set `PUBLIC_SITE_URL=https://your-real-domain` in Netlify and rebuild. The placeholder `https://herb-all.example` is not a live domain. Canonical links, sitemap, robots, RSS and JSON-LD all use this central value. The sitemap integration produces `/sitemap-index.xml`, pointing to `/sitemap-0.xml`. A post-build step copies that index to `/sitemap.xml` for the conventional discovery URL. Both indexes reference the same generated chunks; no manually maintained URL list exists.

## Connect Google Search Console

1. Sign into [Search Console](https://search.google.com/search-console) with the owner’s Google account.
2. Add a **Domain** property for the final domain. Google will provide a DNS TXT verification record.
3. Add that exact TXT record at your domain/DNS provider and return to verify ownership. Keep it in place.
4. Open **Sitemaps** and submit `https://your-real-domain/sitemap.xml`.
5. Use **URL Inspection** for the homepage and a few catalogue/article pages. After a live test, request indexing where appropriate. Indexing is Google’s decision and is not guaranteed.
6. Review **Performance** for impressions, clicks, queries and pages. Check page indexing reports for errors. Changes can take time to appear.

Official owner instructions: [verify ownership](https://support.google.com/webmasters/answer/9008080), [manage sitemaps](https://support.google.com/webmasters/answer/7451001), [URL Inspection](https://support.google.com/webmasters/answer/9012289).

## Editorial SEO

Write useful original content and honest descriptions. Verify scientific sources, botanical identities and local growing information before expanding claims. Publish only reviewed entries. Categories/tags contain genuine articles, not keyword-only doorway copy. Configure accurate authors and dates. Replace placeholder images with rights-cleared photos and descriptive alt text. Inspect social previews after deployment. Avoid testimonials, medical claims, ratings or location data that have not been supplied.

## Preview and production

Production robots allow crawling. Draft and future articles are excluded. 404 is noindex. For Netlify deploy previews, configure an `X-Robots-Tag: noindex` response header in preview contexts if publicly accessible, without blocking production. Do not block production robots as a workaround for demo content. Final commercial launch requires domain/contact/owner content review.

## Analytics later

Analytics are optional and not installed. If adding Google Analytics, review privacy/consent requirements, update the privacy notice and use the owner’s actual measurement ID. Do not use analytics as a substitute for Search Console indexing reports.
