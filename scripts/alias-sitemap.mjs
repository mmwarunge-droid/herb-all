import { copyFileSync } from 'node:fs';
// Preserve every sitemap chunk referenced by the integration’s index.
copyFileSync(
  new URL('../dist/sitemap-index.xml', import.meta.url),
  new URL('../dist/sitemap.xml', import.meta.url),
);
