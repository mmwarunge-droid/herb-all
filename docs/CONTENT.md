# Maintain Herb-All content

## Edit a product

Open a file in `src/content/products/`, change the text above and below the `---` lines, save, then run `npm run check` and `npm run build`. The header is YAML (frontmatter). Keep quotation marks around text containing punctuation.

```yaml
title: 'Mint Tea'
slug: 'mint-tea'
description: 'A mint-led infusion to explore.'
category: 'Herbal Teas'
botanicalName: 'Confirm actual species'
ingredient: 'Mint'
ingredients: ['Confirm final ingredients']
image: '/images/mint.webp'
imageAlt: 'Describe the actual image accurately'
featured: false
preparation: 'Verified label instructions'
cautions: ['Confirmed product warnings']
tags: ['mint', 'tea']
draft: true
```

Name the file `mint-tea.md`. Write readable Markdown below the second `---`. Keep it a draft until the product is verified. Set `draft: false` to publish. Slugs must be unique within each collection and use lowercase words separated by hyphens. Featured products appear on the homepage. Do not promise medical outcomes or claim stocked availability without confirmation.

Optional `price: 250` and `currency: "KES"` can be added together after owner confirmation. No checkout is enabled. Never fabricate prices, reviews or ratings. Product JSON-LD intentionally omits offers, reviews and availability; catalogue-only markup does not promise Google product rich-result eligibility.

## Add a seedling

Copy a file in `src/content/seedlings/`. Update title, slug, description, botanicalName, category, image, imageAlt, climate, maturity, spacing, care (list), featured, tags and draft. Write planting guidance in Markdown below the header. Ask an appropriate agricultural reviewer to verify cultivar, propagation, climate and spacing information before adding precise figures. Keep the variability disclaimer; never guarantee yield or maturity.

## Add an article

Copy an entry in `src/content/articles/`. Update title, slug, description, category, image, imageAlt, publishedDate, updatedDate, author, tags, references, editorialReview and draft. Dates use `YYYY-MM-DD`; future-dated articles remain unpublished until a new build after that date. Drafts are excluded from routes, lists, sitemap and RSS. Category and tag archives are generated automatically from published articles. Reading time is calculated from body length.

```yaml
references:
  - title: 'The actual source title'
    url: 'https://authoritative-source.example/actual-page'
```

The example URL is a placeholder, not a citation. Never copy it into published content. If references are not available, leave `references: []` and `editorialReview: true`; the page will display the review notice. Distinguish Traditional Use, Nutritional Properties, Current Scientific Evidence and Safety Considerations where relevant. All existing sample articles require editorial review. A disclaimer does not legitimise an unsupported health claim.

## Replace photographs

Place rights-cleared, accurate images in `public/images/`. Use compressed WebP where possible, typically 1200px wide or less. Add smaller variants when useful; update `image` and `imageAlt` in frontmatter. The same generic tea/nursery photos are intentionally shared by starter entries, not presented as accurate species/product photos. The current photos and license are documented in `IMAGES.md`. Missing images fall back to the local botanical photo, with corrected alt text. Keep that fallback file present. The default social card is controlled in site configuration.

## Update contact and social information

Copy `.env.example` to `.env`. Fill in the public configuration values. Values prefixed PUBLIC are visible in the website; never put secrets there. On Netlify enter the same values in project environment variables and rebuild. Supply a complete HTTPS URL for social profiles, an email address, a dialable phone number and a WhatsApp number including country code. Links are generated centrally, and product names are included in email/WhatsApp enquiries.

## Review before publishing

Preview the page on a phone and desktop. Check title, photograph, alt text and links. Verify spelling, botanical identity and all factual statements. Ensure legal and health text has the appropriate owner review. Run the checks and production build before deploying.

Optional Netlify Forms can be enabled with `PUBLIC_ENABLE_NETLIFY_FORM=true` after hosting/form detection and privacy review. See DEPLOYMENT; local previews do not certify provider delivery.
