import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
const base = {
  title: z.string(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string(),
  category: z.string(),
  image: z.string().default('/images/botanical.webp'),
  imageAlt: z.string(),
  featured: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
};
const products = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/products' }),
  schema: z
    .object({
      ...base,
      botanicalName: z.string(),
      ingredient: z.string(),
      ingredients: z.array(z.string()),
      preparation: z.string(),
      cautions: z.array(z.string()),
      price: z.number().nonnegative().optional(),
      currency: z.string().length(3).optional(),
    })
    .refine((data) => data.price === undefined || !!data.currency, {
      message: 'A price requires an ISO currency code',
    }),
});
const seedlings = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/seedlings' }),
  schema: z.object({
    ...base,
    botanicalName: z.string(),
    climate: z.string(),
    maturity: z.string(),
    spacing: z.string(),
    care: z.array(z.string()),
  }),
});
const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    ...base,
    publishedDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string(),
    references: z
      .array(z.object({ title: z.string(), url: z.url() }))
      .default([]),
    editorialReview: z.boolean().default(true),
  }),
});
export const collections = { products, seedlings, articles };
