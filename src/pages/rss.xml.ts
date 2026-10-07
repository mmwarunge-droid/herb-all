import rss from '@astrojs/rss';
import { publishedArticles } from '../utils/content';
import { site } from '../config/site';
export async function GET() {
  return rss({
    title: 'Herb-All Journal',
    description: site.siteDescription,
    site: site.siteUrl,
    items: (await publishedArticles()).map((e) => ({
      title: e.data.title,
      pubDate: e.data.publishedDate,
      description: e.data.description,
      link: `/learn/${e.data.slug}/`,
    })),
  });
}
