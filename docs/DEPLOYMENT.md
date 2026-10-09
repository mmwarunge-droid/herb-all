# Commerce deployment update

The site now includes serverless commerce. Follow [COMMERCE_OPERATIONS](COMMERCE_OPERATIONS.md) for PostgreSQL, runtime secrets, migrations, administrator setup and release gates. Static-only deployment does not enable the Shop. Existing site configuration below describes the inherited informational frontend; new commerce requires the additional steps above.

# Publish with Netlify

This is a static website. No server, database, adapter, payment provider or secret is needed.

## Create your own GitHub repository

Create a new empty repository in your GitHub account, for example `herb-all`. The checkout retains upstream history and license. If an upstream remote exists, retain it for provenance and add your own remote as `origin`. Do not push to lonestone’s template repository. Review `git status`, stage only site source and documentation, commit, then push to your own repository. The `.gitignore` excludes dependencies, builds, local environment files and reports. Never commit credentials.

## Import into Netlify

1. In Netlify, choose **Add new project → Import an existing project** and connect your GitHub repository.
2. Choose the directory containing this `package.json`. If uploading only Herb-All as its own repository, leave the base directory empty. If intentionally importing a larger monorepo, specify the exact subdirectory.
3. Build command: `npm run build`; publish directory: `dist`; Node version: 22 (configured in `netlify.toml`).
4. In project environment variables set `PUBLIC_SITE_URL` to the final HTTPS origin and supply `PUBLIC_BUSINESS_EMAIL`, `PUBLIC_PHONE_NUMBER`, `PUBLIC_WHATSAPP_NUMBER`, `PUBLIC_INSTAGRAM_URL`, `PUBLIC_FACEBOOK_URL` as appropriate. The example file lists every value. These are public business details, not secrets.
5. Deploy, add the final custom domain in domain management and follow Netlify’s DNS/HTTPS instructions. Set `PUBLIC_SITE_URL` to that domain and deploy again if it changed.
6. Check homepage, product/seedling/article routes, contact links, images, `/robots.txt`, `/sitemap.xml` and `/rss.xml`. Test an enquiry with your own account, not a customer’s.
7. Complete the Search Console steps in `SEO.md`.

Direct contact links work without a form. The default enquiry composer opens the visitor’s email client; it never silently submits a message.

## Optional Netlify Forms

To receive messages without an email client, enable form detection in your Netlify project and set `PUBLIC_ENABLE_NETLIFY_FORM=true`, then rebuild and redeploy. [Netlify’s documented setup](https://docs.netlify.com/manage/forms/setup/) supports static HTML forms. The generated HTML contains `name="herb-all-enquiry"`, `data-netlify="true"`, hidden `form-name` and a honeypot. Submissions redirect to `/contact/thanks/`. No custom server is required. Check plan limits, notification settings and retention requirements with the owner. Update/review privacy copy, submit a test from your own account and verify receipt in Netlify’s Forms dashboard before relying on it. Local previews cannot certify Netlify submission handling. Set the variable to `false` to return to the email composer, or remove the form; direct links remain functional.

## Local release checks

```sh
npm ci
npm run check
npm run build
npm run test
npx playwright install chromium
npm run test:browser
npm run preview
```

A successful build is not a live deployment. This handoff does not create GitHub or Netlify account resources. Use your account to import the repository after reviewing placeholders and sample copy.

## Updating and rolling back

Edit content, check, build and commit to your own repository. Netlify rebuilds after configured branch pushes. Recheck affected pages. To roll back a bad release, select a prior verified Netlify deploy; correct source before pushing again. Keep the domain and business configuration consistent.

## Commercial launch checklist

- Final domain and direct contact channel configured.
- Product ingredients, pack details, preparation and safety cautions confirmed.
- Real product/stock photos replacing clearly labelled placeholders.
- Seedling cultivars and local growing advice reviewed.
- Articles and citations reviewed; actual authors/dates confirmed.
- Privacy, terms and disclaimer reviewed for the actual business and jurisdiction.
- Enquiry links tested; no claim that unsent email has been received.
- Search Console ownership/sitemap checked.
