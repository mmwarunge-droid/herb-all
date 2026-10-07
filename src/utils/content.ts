import { getCollection } from 'astro:content';
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const publishedProducts = () =>
  getCollection('products', ({ data }) => !data.draft);
export const publishedSeedlings = () =>
  getCollection('seedlings', ({ data }) => !data.draft);
export const publishedArticles = async () =>
  (
    await getCollection(
      'articles',
      ({ data }) => !data.draft && data.publishedDate <= new Date(),
    )
  ).sort(
    (a, b) => b.data.publishedDate.getTime() - a.data.publishedDate.getTime(),
  );
export const readingTime = (body?: string) =>
  Math.max(1, Math.ceil((body || '').split(/\s+/).length / 200));
