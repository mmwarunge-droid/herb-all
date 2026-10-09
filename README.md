# Herb-All

A fast, static botanical catalogue and educational website: herbal products, useful seedlings and a plant knowledge hub. Customers enquire directly; there is no cart, payment system, authentication, database or analytics.

Adapted from [lonestone/astro-template](https://github.com/lonestone/astro-template), upstream commit `155a3cc8bc3bcfc19ff4bc26acdf0bdacb1ec01d`. The MIT license permits commercial adaptation; the original LICENSE is retained. See [starter audit](docs/STARTER.md). Astro and integrations were upgraded from upstream Astro 6 to Astro 7 following the dependency audit.

## Local development

Use Node 22.12 or newer (Node 22 recommended).

```sh
npm install
cp .env.example .env
npm run dev
npm run check
npm run build
npm run test
npm run preview
```

`dev` and `preview` print their local URLs. Browser tests: `npx playwright install chromium`, then `npm run test:browser`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when using a preinstalled Chromium. Browser tests start their own production preview, so build first. Astro telemetry can be disabled using `ASTRO_TELEMETRY_DISABLED=1`.

## Main files

- `src/config/site.ts`: name, description, contact channels, social links, domain and default social image.
- `src/content.config.ts`: validated products, seedlings and articles.
- `src/content/`: Markdown starter entries; six products, six seedlings, six articles.
- `src/pages/`: static pages, collection detail routes, category/tag archives, RSS and robots.
- `src/layouts/BaseLayout.astro`: site layout and navigation.
- `src/components/`: adapted breadcrumb/social/JSON-LD components, SEO, disclaimer, cards and browser filtering.
- `src/styles/global.css`: botanical theme and responsive layouts.
- `public/images/`: licensed, illustrative photographs and local social card.
- `netlify.toml`: static build configuration and response headers.

Unneeded starter CMS, multilingual routes, API documentation, diagrams, code highlighting, video embeds and case studies were removed. Native Astro components provide the UI; small client scripts handle filtering, image fallback and email enquiries. Filters preserve query parameters; content is fully visible without JavaScript.

## Editing the website

Read [CONTENT](docs/CONTENT.md) to add products, seedlings or articles, mark drafts and replace images. Contact information is configured through `.env` locally and Netlify environment variables for deployment. Changing a value requires a rebuild. Social links appear only when configured; absent contact details never produce fake working links.

## Deploy to Netlify

See [DEPLOYMENT](docs/DEPLOYMENT.md). Build command: `npm run build`. Publish directory: `dist`. No Netlify adapter or server is needed. Continue using the existing `mmwarunge-droid/herb-all` repository and its existing hosting configuration. Review a feature branch before merging; do not create a replacement repository. Do not upload `.env`, `node_modules`, screenshots or test reports.

## Before commercial launch

Replace `PUBLIC_SITE_URL` with the final HTTPS domain and supply business email, telephone, WhatsApp, Instagram and Facebook URLs. Replace illustrative photos with accurate product/stock images. Confirm ingredients, packaging, preparation, cautions, stock and any optional prices. Review botanical and growing information, article authors/dates, scientific references and starter legal copy. Current entries are explicitly samples; no medicinal benefit, exact agronomic yield or fake price is asserted. Contact email is required to enable the email enquiry composer. By default that form opens the visitor’s email client. Optional Netlify Forms can be enabled after form detection, privacy review and a real hosting test; see DEPLOYMENT.

Search Console instructions are in [SEO](docs/SEO.md). A GitHub or Netlify account, live domain or hosting deployment is not created by the source build. Deployment needs your GitHub/Netlify account and final business configuration.

Future commerce can use product slugs and optional prices/currency as identifiers. Availability, inventory, a CMS or checkout can be added without changing the public content-first architecture; none is implemented now.

## Founder and gardens enhancement

`src/config/brand.ts` contains founder details, supplied photo references and enquiry topics. `FounderStory.astro` and `EnquiryPanel.astro` share the story and calls to action across the homepage, About and Gardens pages. `/gardens/` presents the growing collection, wheatgrass cultivation and arranged visits/learning. The labelled contact selector prefills recognised enquiry topics; contact channels use owner-confirmed public defaults, with environment overrides supported.

See [image inventory](docs/IMAGE_INVENTORY.md), [factual review](docs/FOUNDER_FACT_CHECK.md) and [implementation report](docs/ENHANCEMENT_REPORT.md). Run `npm run images:optimize` after an intentional source-image update, updating the checksummed source manifest first. Originals remain outside `public/` and `dist/`.
