import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { site } from './src/config/site';
export default defineConfig({
  site: site.siteUrl,
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    mdx(),
    sitemap({
      filter: (url) =>
        !url.includes('/contact/thanks/') &&
        !url.endsWith('/404/') &&
        !url.endsWith('/404.html'),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
